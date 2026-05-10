'use client'

import { useState } from 'react'
import { Clock, Save, RotateCcw } from 'lucide-react'
import { ESP32Service } from '../services/ESP32Service'

interface ScheduleConfigProps {
  currentStart: string
  currentEnd: string
}

export function ScheduleConfig({ currentStart, currentEnd }: ScheduleConfigProps) {
  const [startTime, setStartTime] = useState(currentStart)
  const [endTime, setEndTime] = useState(currentEnd)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      await ESP32Service.setSchedule({
        startTime,
        endTime,
        enabled: isEnabled
      })
      setSaveMessage('✅ Configuration sauvegardée avec succès!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
      setSaveMessage('❌ Erreur lors de la sauvegarde')
      setTimeout(() => setSaveMessage(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setStartTime(currentStart)
    setEndTime(currentEnd)
    setIsEnabled(true)
    setSaveMessage(null)
  }

  const hasChanges = startTime !== currentStart || endTime !== currentEnd

  const isValidTime = (time: string) => {
    if (!time || typeof time !== 'string') return false
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    return regex.test(time)
  }

  const calculateDuration = () => {
    if (!isValidTime(startTime) || !isValidTime(endTime)) return 'Format invalide'
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    let duration = endMinutes - startMinutes
    if (duration < 0) {
      duration += 24 * 60 // Ajouter 24h si traverse minuit
    }
    
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    
    return `${hours}h ${minutes > 0 ? minutes + 'min' : ''}`
  }

  const getScheduleStatus = () => {
    if (!isValidTime(startTime) || !isValidTime(endTime)) return null
    
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    let isActive = false
    if (startMinutes > endMinutes) {
      // Traverse minuit
      isActive = currentMinutes >= startMinutes || currentMinutes <= endMinutes
    } else {
      isActive = currentMinutes >= startMinutes && currentMinutes <= endMinutes
    }
    
    return {
      isActive,
      status: isActive ? 'Période AUTO active' : 'Hors période AUTO',
      color: isActive ? 'text-success-600' : 'text-gray-600',
      bgColor: isActive ? 'bg-success-50' : 'bg-gray-50'
    }
  }

  const scheduleStatus = getScheduleStatus()

  return (
    <div className="space-y-6">
      {/* Configuration des horaires */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            Configuration des Horaires AUTO
          </h2>
          
          {scheduleStatus && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${scheduleStatus.bgColor} ${scheduleStatus.color}`}>
              {scheduleStatus.status}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Heure de début */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Heure de début (activation)
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500">
              Les relais en mode AUTO s'activeront à cette heure
            </p>
          </div>

          {/* Heure de fin */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Heure de fin (désactivation)
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500">
              Les relais en mode AUTO se désactiveront à cette heure
            </p>
          </div>
        </div>

        {/* Informations calculées */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Résumé de la programmation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Début:</span>
              <div className="font-mono font-semibold text-lg">{startTime}</div>
            </div>
            <div>
              <span className="text-gray-600">Fin:</span>
              <div className="font-mono font-semibold text-lg">{endTime}</div>
            </div>
            <div>
              <span className="text-gray-600">Durée:</span>
              <div className="font-semibold text-lg">{calculateDuration()}</div>
            </div>
          </div>
          
          {startTime > endTime && (
            <div className="mt-3 p-2 bg-warning-50 border border-warning-200 rounded text-sm text-warning-700">
              ⚠️ La programmation traverse minuit ({startTime} → {endTime} le lendemain)
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !isValidTime(startTime) || !isValidTime(endTime)}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Sauvegarder
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Annuler
          </button>

          {saveMessage && (
            <div className={`flex items-center px-4 py-2 rounded-lg ${
              saveMessage.startsWith('✅') 
                ? 'bg-success-50 text-success-600' 
                : 'bg-danger-50 text-danger-600'
            }`}>
              {saveMessage}
            </div>
          )}
        </div>
      </div>

      {/* Exemples de programmation */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Exemples de Programmation</h3>
        
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">Mode nuit</div>
              <div className="text-sm text-gray-600">Activation durant la nuit</div>
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <button
                onClick={() => { setStartTime('22:00'); setEndTime('06:00'); }}
                className="text-sm px-3 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
              >
                22:00 → 06:00
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">Soirée + matin</div>
              <div className="text-sm text-gray-600">Soirée et début de matinée</div>
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <button
                onClick={() => { setStartTime('19:00'); setEndTime('08:00'); }}
                className="text-sm px-3 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
              >
                19:00 → 08:00
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">Configuration actuelle</div>
              <div className="text-sm text-gray-600">Horaires actuellement programmés</div>
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <span className="text-sm px-3 py-1 bg-success-100 text-success-700 rounded">
                {currentStart} → {currentEnd}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Informations importantes */}
      <div className="card bg-primary-50 border-primary-200">
        <h3 className="text-lg font-semibold text-primary-900 mb-3">ℹ️ Informations importantes</h3>
        <div className="text-sm text-primary-800 space-y-2">
          <p>
            • Les horaires s'appliquent uniquement aux canaux configurés en mode <strong>AUTO</strong>
          </p>
          <p>
            • Les canaux en mode <strong>OFF</strong> ou <strong>ON</strong> ne sont pas affectés par la programmation
          </p>
          <p>
            • La synchronisation horaire se fait automatiquement via NTP (Internet)
          </p>
          <p>
            • Les modifications prennent effet immédiatement après sauvegarde
          </p>
        </div>
      </div>
    </div>
  )
}