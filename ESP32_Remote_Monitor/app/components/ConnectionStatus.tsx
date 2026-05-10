'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'

interface ConnectionStatusProps {
  isConnected: boolean
  mqttConnected?: boolean
  lastUpdate?: string
  error?: string | null
}

export function ConnectionStatus({ isConnected, mqttConnected = false, lastUpdate, error }: ConnectionStatusProps) {
  const [lastSeen, setLastSeen] = useState<Date>(new Date())
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good')

  useEffect(() => {
    if (isConnected && mqttConnected) {
      setLastSeen(new Date())
      setConnectionQuality('good')
    } else if (isConnected && !mqttConnected) {
      setConnectionQuality('poor')
    } else {
      // Utiliser une fonction pour calculer la qualité basée sur le lastSeen actuel
      const checkConnectionQuality = () => {
        const timeSinceLastSeen = Date.now() - lastSeen.getTime()
        if (timeSinceLastSeen > 30000) {
          setConnectionQuality('offline')
        } else if (timeSinceLastSeen > 10000) {
          setConnectionQuality('poor')
        }
      }
      
      checkConnectionQuality()
      
      // Vérifier la qualité périodiquement quand déconnecté
      const interval = setInterval(checkConnectionQuality, 5000)
      return () => clearInterval(interval)
    }
  }, [isConnected, mqttConnected])

  const getStatusConfig = () => {
    if (error) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Erreur',
        subText: error,
        bgColor: 'bg-red-50',
        textColor: 'text-red-600',
        borderColor: 'border-red-200',
        pulseColor: 'bg-red-500'
      }
    }

    if (isConnected && mqttConnected) {
      return {
        icon: <Wifi className="w-4 h-4" />,
        text: 'MQTT Connecté',
        subText: 'Temps réel actif',
        bgColor: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200',
        pulseColor: 'bg-green-500'
      }
    } else if (mqttConnected && !isConnected) {
      return {
        icon: <Wifi className="w-4 h-4" />,
        text: 'MQTT Connecté',
        subText: 'En attente données ESP32...',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-200',
        pulseColor: 'bg-blue-500'
      }
    } else if (isConnected && !mqttConnected) {
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Mode HTTP',
        subText: 'MQTT non disponible',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-600',
        borderColor: 'border-yellow-200',
        pulseColor: 'bg-yellow-500'
      }
    } else {
      return {
        icon: <WifiOff className="w-4 h-4" />,
        text: 'Hors ligne',
        subText: 'Connexion en cours...',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-200',
        pulseColor: 'bg-gray-500'
      }
    }
  }

  const status = getStatusConfig()

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${status.bgColor} ${status.borderColor}`}>
      <div className="flex items-center gap-3">
        {/* Indicateur de statut avec animation */}
        <div className="relative flex items-center">
          {status.icon}
          {(isConnected || mqttConnected) && (
            <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 ${status.pulseColor} rounded-full animate-pulse`}></div>
          )}
        </div>
        
        {/* Texte de statut */}
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${status.textColor}`}>
            {status.text}
          </span>
          <span className={`text-xs ${status.textColor} opacity-75`}>
            {status.subText}
          </span>
        </div>
      </div>

      {/* Informations supplémentaires */}
      {lastUpdate && (
        <div className="text-right">
          <div className="text-xs text-gray-500">
            Dernière mise à jour
          </div>
          <div className="text-xs font-mono text-gray-600">
            {new Date(lastUpdate).toLocaleTimeString('fr-FR')}
          </div>
        </div>
      )}
    </div>
  )
}