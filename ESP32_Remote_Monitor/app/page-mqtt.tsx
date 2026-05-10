'use client'

import { useState, useEffect, useRef } from 'react'
import { RelayDashboard } from './components/RelayDashboard'
import { SystemInfo } from './components/SystemInfo'
import { ScheduleConfig } from './components/ScheduleConfig'
import { ConnectionStatus } from './components/ConnectionStatus'
import { esp32MqttService } from './services/ESP32MqttService'
import { ESP32Status, RelayChannel, ChannelState } from './types/ESP32Types'

export default function HomePage() {
  const [status, setStatus] = useState<ESP32Status | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isMqttConnected, setIsMqttConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(false)
  const connectionAttemptRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    
    console.log('🚀 HomePage: Initialisation MQTT...')
    
    // S'abonner aux mises à jour de statut
    esp32MqttService.onStatusUpdate((newStatus: ESP32Status) => {
      console.log('📊 Status update received:', newStatus)
      if (isMountedRef.current) {
        setStatus(newStatus)
        setIsConnected(true)
        setError(null)
        setIsLoading(false)
      }
    })

    // S'abonner aux changements de connexion
    esp32MqttService.onConnectionChange((connected: boolean) => {
      console.log('🔌 MQTT Connection change:', connected)
      if (isMountedRef.current) {
        setIsMqttConnected(connected)
        
        if (!connected && !error) {
          setError('Connexion MQTT perdue')
          setIsConnected(false)
        }
      }
    })

    // Tenter la connexion MQTT
    if (!connectionAttemptRef.current) {
      connectionAttemptRef.current = true
      console.log('🔄 Attempting MQTT connection...')
      
      esp32MqttService.connect().then((success) => {
        console.log('🔗 MQTT Connection result:', success)
        if (isMountedRef.current) {
          if (success) {
            // Vérifier si on a déjà un statut
            const lastStatus = esp32MqttService.getLastStatus()
            if (lastStatus) {
              setStatus(lastStatus)
              setIsConnected(true)
            }
          } else {
            setError('Impossible de se connecter au broker MQTT')
          }
          setIsLoading(false)
        }
      }).catch((err) => {
        console.error('❌ MQTT Connection error:', err)
        if (isMountedRef.current) {
          setError('Erreur de connexion MQTT: ' + err.message)
          setIsLoading(false)
        }
      })
    }

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleChannelChange = async (channelId: number, newState: ChannelState) => {
    try {
      console.log(`🔧 Changing channel ${channelId} to state ${newState}`)
      
      await esp32MqttService.setChannel(channelId, newState)
      
      // Mise à jour optimiste de l'interface
      if (status) {
        const updatedChannels = status.channels.map(channel =>
          channel.id === channelId
            ? { ...channel, state: newState, lastChanged: new Date().toISOString() }
            : channel
        )
        setStatus({ ...status, channels: updatedChannels })
      }
      
    } catch (error) {
      console.error('❌ Error changing channel:', error)
      setError(`Erreur lors du changement du canal: ${error}`)
      
      // Revert optimistic update si nécessaire
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleScheduleChange = async (startTime: string, endTime: string) => {
    try {
      console.log(`🕐 Changing schedule: ${startTime} - ${endTime}`)
      
      await esp32MqttService.setSchedule(startTime, endTime)
      
      // Mise à jour optimiste de l'interface
      if (status) {
        setStatus({
          ...status,
          scheduleStart: startTime,
          scheduleEnd: endTime,
          lastUpdate: new Date().toISOString()
        })
      }
      
    } catch (error) {
      console.error('❌ Error changing schedule:', error)
      setError(`Erreur lors du changement d'horaire: ${error}`)
      
      setTimeout(() => setError(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Connexion MQTT...</h2>
            <p className="text-gray-500">Établissement de la connexion temps réel avec l'ESP32</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="text-center py-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            The Green House
          </h1>
          <p className="text-gray-600">
            🌱 Contrôle à distance via Internet
          </p>
        </div>

        {/* Statut de connexion */}
        <ConnectionStatus 
          isConnected={isConnected}
          mqttConnected={isMqttConnected}
          lastUpdate={status?.lastUpdate}
          error={error}
        />

        {/* Contenu principal */}
        {status ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contrôle des relais */}
            <div className="lg:col-span-2">
              <RelayDashboard
                channels={status.channels}
                currentTime={status.currentTime}
                scheduleStart={status.scheduleStart}
                scheduleEnd={status.scheduleEnd}
                onChannelChange={handleChannelChange}
              />
            </div>

            {/* Panneau latéral */}
            <div className="space-y-6">
              {/* Configuration horaire */}
              <ScheduleConfig
                currentStart={status.scheduleStart}
                currentEnd={status.scheduleEnd}
              />

              {/* Informations système */}
              <SystemInfo
                systemInfo={status.systemInfo}
                wifiInfo={status.wifiInfo}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
              <div className="text-red-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Connexion Impossible
              </h3>
              <p className="text-red-600 mb-4">
                {error || "Impossible de se connecter à l'ESP32 via MQTT"}
              </p>
              <div className="text-sm text-red-500">
                <p>• Vérifiez que l'ESP32 est allumé</p>
                <p>• Vérifiez la connexion Internet</p>
                <p>• L'ESP32 doit utiliser le firmware MQTT</p>
              </div>
            </div>
          </div>
        )}

        {/* Informations MQTT */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isMqttConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium text-gray-700">
                MQTT Broker: {isMqttConnected ? 'Connecté' : 'Déconnecté'}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              broker.hivemq.com:8000 (WebSocket)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}