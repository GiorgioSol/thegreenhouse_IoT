'use client'

import { useState } from 'react'
import { RelayChannel, ChannelState, ChannelStateNames } from '../types/ESP32Types'
import { Power, Clock, Zap } from 'lucide-react'

interface RelayDashboardProps {
  channels: RelayChannel[]
  currentTime: string
  scheduleStart: string
  scheduleEnd: string
  onChannelChange: (channelId: number, state: ChannelState) => Promise<void>
}

export function RelayDashboard({
  channels,
  currentTime,
  scheduleStart,
  scheduleEnd,
  onChannelChange
}: RelayDashboardProps) {
  const [loadingChannels, setLoadingChannels] = useState<Set<number>>(new Set())

  const handleChannelChange = async (channelId: number, newState: ChannelState) => {
    setLoadingChannels(prev => new Set(prev).add(channelId))
    
    try {
      await onChannelChange(channelId, newState)
    } catch (error) {
      console.error('Erreur changement canal:', error)
    } finally {
      setLoadingChannels(prev => {
        const newSet = new Set(prev)
        newSet.delete(channelId)
        return newSet
      })
    }
  }

  const getStateButtonClass = (channelState: ChannelState, buttonState: ChannelState) => {
    const baseClass = 'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50'
    
    // Style unifié : pas de couleur pour les modes, juste indicateur de sélection
    if (channelState === buttonState) {
      return `${baseClass} bg-gray-200 text-gray-800 border-2 border-gray-400 shadow-md`
    } else {
      return `${baseClass} bg-white text-gray-600 hover:bg-gray-50 border border-gray-300`
    }
  }

  return (
    <div className="space-y-6">
      {/* Info horaires */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-500" />
            Informations Temporelles
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-gray-900">
              {currentTime}
            </div>
            <div className="text-sm text-gray-500">Heure actuelle</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-primary-600">
              {scheduleStart} → {scheduleEnd}
            </div>
            <div className="text-sm text-gray-500">Plage AUTO</div>
          </div>
          
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isInScheduleTime(scheduleStart, scheduleEnd)
                ? 'bg-success-50 text-success-600'
                : 'bg-gray-50 text-gray-600'
            }`}>
              {isInScheduleTime(scheduleStart, scheduleEnd) ? '✅ Période AUTO' : '⏸️ Hors période'}
            </div>
          </div>
        </div>
      </div>

      {/* Grille des canaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map((channel) => {
          const isLoading = loadingChannels.has(channel.id)
          
          return (
            <div key={channel.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${
                    channel.isActive ? 'text-success-500' : 'text-gray-400'
                  }`} />
                  {channel.name}
                </h3>
                
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  channel.isActive 
                    ? 'bg-green-500 text-white border-green-500' 
                    : 'bg-transparent text-gray-500 border-gray-300'
                }`}>
                  {channel.isActive ? 'ACTIF' : 'INACTIF'}
                </div>
              </div>

              {/* Boutons de contrôle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleChannelChange(channel.id, 0)}
                  disabled={isLoading}
                  className={getStateButtonClass(channel.state, 0)}
                >
                  {isLoading && channel.state !== 0 ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    'OFF'
                  )}
                </button>
                
                <button
                  onClick={() => handleChannelChange(channel.id, 1)}
                  disabled={isLoading}
                  className={getStateButtonClass(channel.state, 1)}
                >
                  {isLoading && channel.state !== 1 ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    'AUTO'
                  )}
                </button>
                
                <button
                  onClick={() => handleChannelChange(channel.id, 2)}
                  disabled={isLoading}
                  className={getStateButtonClass(channel.state, 2)}
                >
                  {isLoading && channel.state !== 2 ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    'ON'
                  )}
                </button>
              </div>

              {/* Informations supplémentaires */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>Mode: <span className="font-medium">{ChannelStateNames[channel.state]}</span></div>
                <div>État: <span className={`font-medium ${
                  channel.isActive ? 'text-success-600' : 'text-gray-600'
                }`}>
                  {channel.isActive ? 'Relais fermé' : 'Relais ouvert'}
                </span></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Légende */}
      <div className="card bg-gray-50">
        <h3 className="font-medium text-gray-900 mb-3">Légende des modes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-danger-500 rounded-full"></div>
            <span><strong>OFF:</strong> Relais toujours ouvert</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-warning-500 rounded-full"></div>
            <span><strong>AUTO:</strong> Suit la programmation horaire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-success-500 rounded-full"></div>
            <span><strong>ON:</strong> Relais toujours fermé</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function isInScheduleTime(start: string, end: string): boolean {
  // Vérification de sécurité
  if (!start || !end) {
    return false
  }

  const now = new Date()
  const currentTime = now.getHours() * 100 + now.getMinutes()
  
  const [startHour, startMin] = start.split(':').map(Number)
  const [endHour, endMin] = end.split(':').map(Number)
  
  const startTime = startHour * 100 + startMin
  const endTime = endHour * 100 + endMin
  
  // Gérer le cas où l'horaire traverse minuit (22:00 → 10:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime
  } else {
    return currentTime >= startTime && currentTime <= endTime
  }
}