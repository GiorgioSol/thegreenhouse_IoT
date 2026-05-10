'use client'

import type { SystemInfo, WifiInfo } from '../types/ESP32Types'
import { Cpu, HardDrive, Wifi, Thermometer, Zap, Globe } from 'lucide-react'

interface SystemInfoProps {
  systemInfo: SystemInfo
  wifiInfo: WifiInfo
}

export function SystemInfo({ systemInfo, wifiInfo }: SystemInfoProps) {
  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return `${mb.toFixed(1)} MB`
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}j ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const getSignalStrength = (rssi: number) => {
    if (rssi > -30) return { level: 'Excellent', color: 'text-success-600', bars: 4 }
    if (rssi > -50) return { level: 'Bon', color: 'text-success-600', bars: 3 }
    if (rssi > -70) return { level: 'Moyen', color: 'text-warning-600', bars: 2 }
    if (rssi > -90) return { level: 'Faible', color: 'text-danger-600', bars: 1 }
    return { level: 'Très faible', color: 'text-danger-600', bars: 0 }
  }

  const memoryUsagePercent = ((systemInfo.totalHeap - systemInfo.freeHeap) / systemInfo.totalHeap) * 100
  const signal = getSignalStrength(wifiInfo.rssi)

  return (
    <div className="space-y-6">
      {/* Informations système */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary-500" />
          Informations Système
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Processeur */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Cpu className="w-4 h-4" />
              Processeur
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {systemInfo.chipModel}
            </div>
            <div className="text-sm text-gray-600">
              {systemInfo.cpuFreq} MHz
            </div>
          </div>

          {/* Température */}
          {systemInfo.temperature && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Thermometer className="w-4 h-4" />
                Température
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {systemInfo.temperature}°C
              </div>
              <div className={`text-sm ${
                systemInfo.temperature > 70 
                  ? 'text-danger-600' 
                  : systemInfo.temperature > 60 
                    ? 'text-warning-600' 
                    : 'text-success-600'
              }`}>
                {systemInfo.temperature > 70 ? 'Élevée' : 
                 systemInfo.temperature > 60 ? 'Normale' : 'Optimale'}
              </div>
            </div>
          )}

          {/* Temps de fonctionnement */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Zap className="w-4 h-4" />
              Temps de fonctionnement
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatUptime(systemInfo.uptime)}
            </div>
            <div className="text-sm text-gray-600">
              Depuis le démarrage
            </div>
          </div>

          {/* Mémoire */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <HardDrive className="w-4 h-4" />
              Mémoire RAM
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatBytes(systemInfo.freeHeap)}
            </div>
            <div className="text-sm text-gray-600">
              libre sur {formatBytes(systemInfo.totalHeap)}
            </div>
          </div>
        </div>

        {/* Barre de progression mémoire */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Utilisation mémoire</span>
            <span className="text-gray-600">{memoryUsagePercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                memoryUsagePercent > 90 ? 'bg-danger-500' :
                memoryUsagePercent > 75 ? 'bg-warning-500' : 'bg-success-500'
              }`}
              style={{ width: `${memoryUsagePercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Informations réseau */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-primary-500" />
          Informations Réseau
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Connexion Wi-Fi */}
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Réseau Wi-Fi</div>
              <div className="text-lg font-semibold text-gray-900">{wifiInfo.ssid}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Signal</div>
              <div className="flex items-center gap-2">
                <div className={`text-lg font-semibold ${signal.color}`}>
                  {wifiInfo.rssi} dBm
                </div>
                <span className={`text-sm ${signal.color}`}>
                  ({signal.level})
                </span>
                {/* Barres de signal */}
                <div className="flex gap-1 ml-2">
                  {[0, 1, 2, 3].map(bar => (
                    <div
                      key={bar}
                      className={`w-1 h-3 ${
                        bar <= signal.bars ? signal.color.replace('text-', 'bg-') : 'bg-gray-300'
                      }`}
                      style={{ height: `${(bar + 1) * 3 + 3}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Adresses réseau */}
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Adresse IP locale</div>
              <div className="text-lg font-mono font-semibold text-gray-900">{wifiInfo.ip}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Passerelle</div>
              <div className="text-lg font-mono font-semibold text-gray-900">{wifiInfo.gatewayIP}</div>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Adresse MAC</div>
              <div className="text-sm font-mono text-gray-600">{wifiInfo.mac}</div>
            </div>
          </div>
        </div>

        {/* Indicateurs de statut */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-success-50 text-success-600 rounded-lg">
            <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Wi-Fi connecté</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg">
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">Serveur web actif</span>
          </div>
          
          {memoryUsagePercent < 90 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-success-50 text-success-600 rounded-lg">
              <HardDrive className="w-4 h-4" />
              <span className="text-sm font-medium">Mémoire OK</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions système */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions Système</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            🔄 Actualiser
          </button>
          
          <button
            onClick={() => {
              const url = `http://${wifiInfo.ip}`
              window.open(url, '_blank')
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            🔗 Interface ESP32
          </button>
          
          <button
            onClick={() => {
              const data = { systemInfo, wifiInfo, timestamp: new Date().toISOString() }
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `esp32-status-${new Date().toISOString().slice(0, 19)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            💾 Exporter données
          </button>
        </div>
      </div>
    </div>
  )
}