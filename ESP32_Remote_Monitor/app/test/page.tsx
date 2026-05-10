'use client'

import { useState } from 'react'
import { ESP32Service } from '../services/ESP32Service'
import { ESP32_CONFIG } from '../config/esp32'

export default function TestPage() {
  const [result, setResult] = useState<string>('Ready to test...')
  const [isLoading, setIsLoading] = useState(false)

  const testConnection = async () => {
    setIsLoading(true)
    setResult('🔄 Test en cours...')

    try {
      console.log('🟡 Test ESP32Service.getStatus()...')
      const status = await ESP32Service.getStatus()
      console.log('🟢 Résultat:', status)
      
      setResult(`✅ Succès !
Status: Connected
Channels: ${status.channels.length}
Active channels: ${status.channels.filter(c => c.isActive).length}
Uptime: ${status.systemInfo.uptime}s
Memory: ${status.systemInfo.freeHeap} bytes
Time: ${status.currentTime}`)
    } catch (error: any) {
      console.error('🔴 Erreur ESP32Service:', error)
      setResult(`❌ Erreur: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testDirect = async () => {
    setIsLoading(true)
    setResult('🔄 Test direct en cours...')

    try {
      const response = await fetch(`${ESP32_CONFIG.BASE_URL}/status`, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      setResult(`✅ Test direct réussi !
Data: ${JSON.stringify(data, null, 2)}`)
    } catch (error: any) {
      console.error('🔴 Erreur test direct:', error)
      setResult(`❌ Test direct échoué: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Test ESP32 Connexion</h1>
      
      <div className="space-y-4 mb-8">
        <button
          onClick={testConnection}
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? '⏳ Test en cours...' : '🔧 Test ESP32Service'}
        </button>
        
        <button
          onClick={testDirect}
          disabled={isLoading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 ml-4"
        >
          {isLoading ? '⏳ Test en cours...' : '🌐 Test Direct Fetch'}
        </button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded">
        <h3 className="font-bold mb-2">Résultat:</h3>
        <pre className="whitespace-pre-wrap text-sm">{result}</pre>
      </div>
      
      <div className="mt-8 text-sm text-gray-600">
        <p><strong>ESP32Service URL:</strong> {ESP32_CONFIG.BASE_URL}</p>
        <p><strong>Timeout:</strong> {ESP32_CONFIG.TIMEOUT}ms</p>
        <p><strong>Poll Interval:</strong> {ESP32_CONFIG.POLL_INTERVAL}ms</p>
      </div>
    </div>
  )
}