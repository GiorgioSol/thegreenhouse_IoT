'use client'

import { useState, useEffect } from 'react'
import { ESP32Service } from '../services/ESP32Service'
import { ESP32_CONFIG } from '../config/esp32'

interface LogEntry {
  timestamp: string
  level: 'info' | 'success' | 'error' | 'warning'
  message: string
  data?: any
}

export default function DiagnosticPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addLog = (level: LogEntry['level'], message: string, data?: any) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    }
    setLogs(prev => [...prev, newLog])
  }

  const clearLogs = () => {
    setLogs([])
  }

  const testProxy = async () => {
    setIsRunning(true)
    addLog('info', 'Test direct du proxy Next.js')
    
    try {
      const response = await fetch('/api/esp32', {
        cache: 'no-cache',
        signal: AbortSignal.timeout(15000)
      })
      
      addLog('success', `Proxy response: ${response.status} ${response.statusText}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      addLog('success', '✅ Proxy fonctionne parfaitement !', data)
      
    } catch (error: any) {
      addLog('error', `❌ Proxy error: ${error.name}`, error.message)
    } finally {
      setIsRunning(false)
    }
  }

  const testESP32Service = async () => {
    setIsRunning(true)
    addLog('info', 'Test ESP32Service (proxy par défaut)')
    
    try {
      const status = await ESP32Service.getStatus()
      addLog('success', '✅ ESP32Service fonctionne parfaitement !', {
        channels: status.channels.length,
        activeChannels: status.channels.filter(c => c.isActive).length,
        uptime: status.systemInfo.uptime,
        currentTime: status.currentTime,
        freeMemory: `${Math.round(status.systemInfo.freeHeap / 1024)}KB`
      })
      
      addLog('success', '🎉 Application prête à utiliser !', 
        'Vous pouvez maintenant aller sur http://localhost:3004 pour contrôler vos relais')
        
    } catch (error: any) {
      addLog('error', `❌ ESP32Service error: ${error.name}`, error.message)
    } finally {
      setIsRunning(false)
    }
  }

  const testQuick = async () => {
    setIsRunning(true)
    addLog('info', '⚡ Test rapide - Proxy direct')
    
    try {
      const response = await fetch('/api/esp32', { cache: 'no-cache' })
      const data = await response.json()
      
      addLog('success', '✅ Connexion ESP32 parfaite !', {
        canaux_actifs: data.channels.filter((c: any) => c.active).length,
        heure_actuelle: data.currentTime,
        uptime: `${Math.floor(data.uptime / 60)} minutes`,
        memoire_libre: `${Math.round(data.freeHeap / 1024)}KB`
      })
      
      addLog('success', '🚀 Prêt ! Rendez-vous sur http://localhost:3004')
      
    } catch (error: any) {
      addLog('error', `❌ Erreur: ${error.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  const testConnection = async () => {
    setIsRunning(true)
    addLog('info', 'Début du test de connexion ESP32')
    addLog('info', `Configuration: ${ESP32_CONFIG.BASE_URL}`)

    try {
      // Test 1: Connexion directe avec fetch
      addLog('info', 'Test 1: Connexion directe avec fetch()')
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          addLog('warning', 'Timeout connexion directe (5s), annulation...')
          controller.abort()
        }, 5000) // Timeout court pour test direct

        const response = await fetch(`${ESP32_CONFIG.BASE_URL}/status`, {
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-cache',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        })

        clearTimeout(timeoutId)
        addLog('success', `✅ Connexion directe réussie: ${response.status} ${response.statusText}`)

        const text = await response.text()
        const data = JSON.parse(text)
        addLog('success', '✅ Données directes reçues', data)

      } catch (directError: any) {
        addLog('warning', `⚠️ Connexion directe échouée: ${directError.name}`, directError.message)
        
        // Test 2: Via le proxy Next.js
        addLog('info', 'Test 2: Connexion via proxy Next.js /api/esp32')
        
        try {
          const proxyResponse = await fetch('/api/esp32', {
            cache: 'no-cache',
            signal: AbortSignal.timeout(20000)
          })
          
          if (!proxyResponse.ok) {
            throw new Error(`Proxy HTTP Error: ${proxyResponse.status} ${proxyResponse.statusText}`)
          }
          
          const proxyData = await proxyResponse.json()
          addLog('success', `✅ Proxy réussi: ${proxyResponse.status}`, proxyData)
          
        } catch (proxyError: any) {
          addLog('error', `❌ Proxy échoué: ${proxyError.name}`, proxyError.message)
          throw proxyError
        }
      }

      // Test 3: ESP32Service complet (avec fallback automatique)
      addLog('info', 'Test 3: ESP32Service avec fallback automatique')
      const status = await ESP32Service.getStatus()
      addLog('success', '🎉 ESP32Service.getStatus() réussi', {
        channels: status.channels.length,
        activeChannels: status.channels.filter(c => c.isActive).length,
        uptime: status.systemInfo.uptime,
        freeMemory: status.systemInfo.freeHeap,
        currentTime: status.currentTime
      })

      addLog('success', '🎉 TOUS LES TESTS RÉUSSIS ! Application ESP32 fonctionnelle')

    } catch (error: any) {
      addLog('error', `❌ Erreur finale: ${error.name}`, error.message)
      
      if (error.name === 'AbortError') {
        addLog('error', '❌ Timeout - ESP32 non accessible sur le réseau')
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
        addLog('error', '❌ Problème CORS/Réseau - Utiliser le proxy Next.js')
      } else if (error.message.includes('JSON')) {
        addLog('error', '❌ Erreur parsing - Réponse ESP32 invalide')
      } else {
        addLog('error', '❌ Erreur inconnue', error.stack)
      }
      
      // Test de récupération finale via proxy
      addLog('info', '🔄 Test de récupération via proxy direct...')
      try {
        const emergencyResponse = await fetch('/api/esp32')
        const emergencyData = await emergencyResponse.json()
        addLog('success', '✅ Proxy de récupération fonctionne !', emergencyData)
      } catch (emergencyError: any) {
        addLog('error', '❌ Proxy de récupération échoué aussi', emergencyError.message)
      }
    } finally {
      setIsRunning(false)
    }
  }

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return '✅'
      case 'error': return '❌'  
      case 'warning': return '⚠️'
      default: return 'ℹ️'
    }
  }

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'error': return 'text-red-600 bg-red-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50' 
      default: return 'text-blue-600 bg-blue-50'
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">🔍 Diagnostic ESP32</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Configuration active:</h3>
        <ul className="text-sm">
          <li><strong>URL ESP32:</strong> {ESP32_CONFIG.BASE_URL}</li>
          <li><strong>Timeout:</strong> {ESP32_CONFIG.TIMEOUT}ms</li>
          <li><strong>Poll Interval:</strong> {ESP32_CONFIG.POLL_INTERVAL}ms</li>
        </ul>
      </div>

      <div className="space-x-4 mb-6">
        <button
          onClick={testQuick}
          disabled={isRunning}
          className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:opacity-50 font-bold"
        >
          {isRunning ? '⏳ Test...' : '⚡ Test rapide (Recommandé)'}
        </button>
        
        <button
          onClick={testESP32Service}
          disabled={isRunning}
          className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {isRunning ? '⏳ Test en cours...' : '🔧 Test ESP32Service'}
        </button>
        
        <button
          onClick={testProxy}
          disabled={isRunning}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isRunning ? '⏳ Test en cours...' : '🔄 Test proxy seul'}
        </button>
        
        <button
          onClick={testConnection}
          disabled={isRunning}
          className="bg-orange-500 text-white px-6 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
        >
          {isRunning ? '⏳ Test en cours...' : '🧪 Diagnostic complet'}
        </button>
        
        <button
          onClick={clearLogs}
          disabled={isRunning}
          className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
        >
          🗑️ Effacer
        </button>
      </div>

      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
        <h3 className="text-white font-bold mb-4">📊 Logs de diagnostic:</h3>
        
        {logs.length === 0 ? (
          <p className="text-gray-400">Aucun log pour le moment. Cliquez sur "Lancer le diagnostic" pour commencer.</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`mb-2 p-2 rounded ${getLogColor(log.level)}`}>
              <div className="flex items-start gap-2">
                <span>{getLogIcon(log.level)}</span>
                <span className="text-gray-600">[{log.timestamp}]</span>
                <span className="flex-1">{log.message}</span>
              </div>
              {log.data && (
                <pre className="mt-1 ml-6 text-xs bg-white p-2 rounded overflow-x-auto">
                  {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p><strong>💡 Conseils de dépannage :</strong></p>
        <ul className="list-disc ml-6 mt-2">
          <li>Vérifiez que l'ESP32 est alimenté et connecté au WiFi</li>
          <li>Testez l'accès direct : <a href="http://192.168.178.46/status" target="_blank" className="text-blue-600 underline">http://192.168.178.46/status</a></li>
          <li>Vérifiez que votre ordinateur est sur le même réseau (192.168.178.x)</li>
          <li>Si timeout: vérifiez l'adresse IP de l'ESP32</li>
        </ul>
      </div>
    </div>
  )
}