'use client'

import { useState, useEffect, useRef } from 'react'
import { RelayDashboard } from './components/RelayDashboard'
import { SystemInfo } from './components/SystemInfo'
import { ScheduleConfig } from './components/ScheduleConfig'
import { ConnectionStatus } from './components/ConnectionStatus'
import { ESP32Service } from './services/ESP32Service'
import { ESP32Status, RelayChannel } from './types/ESP32Types'
import { ESP32_CONFIG } from './config/esp32'

export default function HomePage() {
  const [esp32Status, setEsp32Status] = useState<ESP32Status | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'system'>('dashboard')
  const isFetchingRef = useRef(false) // Protection contre requêtes concurrentes

  useEffect(() => {
    const fetchStatus = async () => {
      // Éviter les requêtes concurrentes
      if (isFetchingRef.current) {
        console.log('⏸️ Requête ESP32 en cours, attente...')
        return
      }
      
      isFetchingRef.current = true
      
      try {
        setConnectionError(null)
        console.log('🔄 Récupération statut ESP32...')
        const status = await ESP32Service.getStatus()
        setEsp32Status(status)
        setIsConnected(true)
        console.log('✅ Statut ESP32 mis à jour')
      } catch (error: any) {
        console.error('❌ Erreur ESP32:', error.message)
        setIsConnected(false)
        setConnectionError(error.message || 'Erreur inconnue')
        // En cas d'erreur, garder les dernières données valides
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    }

    // Fetch initial status
    fetchStatus()

    // Polling adaptatif basé sur la configuration
    const interval = setInterval(fetchStatus, ESP32_CONFIG.POLL_INTERVAL) // 15 secondes

    return () => clearInterval(interval)
  }, []) // Pas de dépendances - useEffect ne s'exécute qu'une fois

  const handleChannelChange = async (channelId: number, state: 0 | 1 | 2) => {
    try {
      await ESP32Service.setChannel(channelId, state)
      // Le status sera mis à jour lors du prochain polling
    } catch (error) {
      console.error('Erreur lors du changement d\'état:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header avec status de connexion */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard ESP32
          </h1>
          <p className="text-gray-600">
            Contrôle et surveillance en temps réel
          </p>
        </div>
        <ConnectionStatus isConnected={isConnected} />
      </div>

      {/* Navigation tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'schedule'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ⏰ Horaires
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'system'
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🔧 Système
        </button>
      </div>

      {/* Content based on active tab */}
      {!isConnected && !isLoading ? (
        <div className="card text-center py-12">
          <div className="text-danger-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connexion impossible
          </h3>
          <p className="text-gray-600 mb-2">
            {connectionError || 'Impossible de se connecter à l\'ESP32'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Vérifiez que l'ESP32 est en ligne sur IP: 192.168.178.46
          </p>
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              🔄 Réessayer
            </button>
            <button
              onClick={() => window.open('http://192.168.178.46', '_blank')}
              className="btn-secondary"
            >
              🌐 Accès direct ESP32
            </button>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && esp32Status && (
            <RelayDashboard
              channels={esp32Status.channels}
              currentTime={esp32Status.currentTime}
              scheduleStart={esp32Status.scheduleStart}
              scheduleEnd={esp32Status.scheduleEnd}
              onChannelChange={handleChannelChange}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleConfig
              currentStart={esp32Status?.scheduleStart || '22:00'}
              currentEnd={esp32Status?.scheduleEnd || '10:00'}
            />
          )}

          {activeTab === 'system' && esp32Status && (
            <SystemInfo
              systemInfo={esp32Status.systemInfo}
              wifiInfo={esp32Status.wifiInfo}
            />
          )}
        </>
      )}
    </div>
  )
}