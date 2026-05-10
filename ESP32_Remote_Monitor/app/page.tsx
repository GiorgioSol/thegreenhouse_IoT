'use client';

import { useState } from 'react';
import { MQTTRelayDashboard } from './components/MQTTRelayDashboard';
import { MQTTMeterDashboard } from './components/MQTTMeterDashboard';
import { useMQTT } from './hooks/useMQTT';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/TabsFixed';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('relays');
  const { status } = useMQTT();

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pwa-safe-area">
      {/* En-tête de connexion */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Green House Control</h1>
            <p className="text-sm sm:text-base text-gray-600">Contrôle à distance via MQTT</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`connection-dot ${
              status.connected ? 'connection-connected' : 
              status.connecting ? 'connection-connecting' : 'connection-error'
            }`}></div>
            <div className="text-right">
              <div className="text-xs sm:text-sm font-medium">
                {status.connected ? 'Connecté' : status.connecting ? 'Connexion...' : 'Déconnecté'}
              </div>
              {status.error && (
                <div className="text-xs text-red-600 max-w-[120px] sm:max-w-none truncate">
                  {status.error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 sticky top-4 z-10">
          <TabsTrigger value="relays">
            <span className="hidden sm:inline">Contrôle Relais</span>
            <span className="sm:hidden">Relais</span>
          </TabsTrigger>
          <TabsTrigger value="meter">
            <span className="hidden sm:inline">Compteur Électrique</span>
            <span className="sm:hidden">Compteur</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relays">
          <MQTTRelayDashboard />
        </TabsContent>

        <TabsContent value="meter">
          <MQTTMeterDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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

    // Tenter la connexion MQTT avec timeout (sauf si MQTT est désactivé)
    if (!connectionAttemptRef.current) {
      connectionAttemptRef.current = true
      
      // Vérifier si MQTT est désactivé
      if (esp32MqttService.isMqttDisabled()) {
        console.log('🚫 MQTT disabled - using HTTP mode directly')
        switchToHttpMode()
        return
      }
      
      console.log('🔄 Attempting MQTT connection...')
      
      // Timeout pour MQTT (5 secondes max - plus rapide)
      const mqttTimeout = setTimeout(() => {
        if (isMountedRef.current && isLoading) {
          console.log('⏰ MQTT timeout - switching to HTTP mode')
          esp32MqttService.disableMqtt() // Désactiver MQTT pour éviter les tentatives futures
          switchToHttpMode()
        }
      }, 5000)
      
      esp32MqttService.connect().then((success) => {
        clearTimeout(mqttTimeout)
        console.log('🔗 MQTT Connection result:', success)
        if (isMountedRef.current) {
          if (success) {
            setConnectionMode('mqtt')
            // Vérifier si on a déjà un statut
            const lastStatus = esp32MqttService.getLastStatus()
            if (lastStatus) {
              setStatus(lastStatus)
              setIsConnected(true)
            }
            setIsLoading(false)
          } else {
            console.log('❌ MQTT failed - trying HTTP fallback')
            switchToHttpMode()
          }
        }
      }).catch((err) => {
        clearTimeout(mqttTimeout)
        console.error('❌ MQTT Connection error:', err)
        if (isMountedRef.current) {
          console.log('🔄 MQTT error - switching to HTTP mode')
          switchToHttpMode()
        }
      })
    }

    // Polling du compteur RS485 toutes les 30 secondes
    const fetchMeter = async () => {
      if (!isMountedRef.current) return
      setMeterLoading(true)
      try {
        const d = await ESP32Service.getMeterData()
        if (isMountedRef.current) {
          setMeterData(d)
          setMeterLastUpdate(new Date().toLocaleTimeString('fr-FR'))
        }
      } finally {
        if (isMountedRef.current) setMeterLoading(false)
      }
    }
    fetchMeter()
    meterIntervalRef.current = setInterval(fetchMeter, 30000)

    return () => {
      isMountedRef.current = false
      if (httpIntervalRef.current) clearInterval(httpIntervalRef.current)
      if (meterIntervalRef.current) clearInterval(meterIntervalRef.current)
    }
  }, [])

  // Handler pour le contrôle des relais (adaptatif MQTT/HTTP)
  const handleChannelToggle = async (channelId: number, newState: any) => {
    try {
      if (connectionMode === 'mqtt' && isMqttConnected) {
        await esp32MqttService.setChannel(channelId, newState)
      } else {
        await httpService.setChannel(channelId, newState)
        // Refresh immédiat en mode HTTP
        setTimeout(async () => {
          try {
            const newStatus = await httpService.getStatus()
            if (isMountedRef.current) {
              setStatus(newStatus)
            }
          } catch (err) {
            console.error('❌ HTTP refresh error:', err)
          }
        }, 100)
      }
    } catch (error) {
      console.error('❌ Error controlling relay:', error)
      setError('Erreur lors du contrôle du relais')
    }
  }

  // Handler pour la programmation horaire (adaptatif MQTT/HTTP)
  const handleScheduleUpdate = async (startTime: string, endTime: string) => {
    try {      
      if (connectionMode === 'mqtt' && isMqttConnected) {
        await esp32MqttService.setSchedule(startTime, endTime)
      } else {
        const scheduleConfig = { startTime, endTime, enabled: true }
        await httpService.setSchedule(scheduleConfig)
        // Refresh immédiat en mode HTTP
        setTimeout(async () => {
          try {
            const newStatus = await httpService.getStatus()
            if (isMountedRef.current) {
              setStatus(newStatus)
            }
          } catch (err) {
            console.error('❌ HTTP refresh error:', err)
          }
        }, 100)
      }
    } catch (error) {
      console.error('❌ Error updating schedule:', error)
      setError('Erreur lors de la mise à jour de la programmation')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              {connectionMode === 'mqtt' ? 'Connexion MQTT...' : 'Connexion HTTP...'}
            </h2>
            <p className="text-gray-500">
              {connectionMode === 'mqtt' 
                ? 'Tentative de connexion MQTT en cours (basculement automatique en HTTP si échec)'
                : 'Connexion HTTP de secours avec l\'ESP32'
              }
            </p>
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

        {/* Compteur RS485 — visible en permanence (indépendant de la connexion relais) */}
        <MeterDashboard
          data={meterData}
          loading={meterLoading}
          lastUpdate={meterLastUpdate}
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
                onChannelChange={handleChannelToggle}
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

        {/* Informations de connexion */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium text-gray-700">
                Mode: {connectionMode.toUpperCase()} - {isConnected ? 'Connecté' : 'Déconnecté'}
              </span>
              {connectionMode === 'mqtt' && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Temps Réel</span>
              )}
              {connectionMode === 'http' && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Polling 3s</span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {connectionMode === 'mqtt' 
                ? 'broker.hivemq.com:8000 (WebSocket)' 
                : '192.168.178.46 (HTTP)'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}