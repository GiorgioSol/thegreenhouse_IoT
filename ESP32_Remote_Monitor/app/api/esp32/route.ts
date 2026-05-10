import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🌐 Proxy ESP32: Récupération du statut...')
    
    // Timeout adapté aux performances réelles de l'ESP32 (30+ secondes observées)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout ESP32 après 30s')
      controller.abort()
    }, 30000)
    
    const startTime = Date.now()
    const response = await fetch('http://192.168.178.46/status', {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Connection': 'close' // Forcer fermeture connexion pour éviter accumulation
      },
    })

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    console.log(`✅ ESP32 Response: ${response.status} (${responseTime}ms)`)

    if (!response.ok) {
      console.error('❌ ESP32 Error:', response.status, response.statusText)
      return NextResponse.json(
        { error: 'ESP32 not reachable', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ ESP32 Data received:', { channels: data.channels?.length, uptime: data.uptime })
    
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('⏰ Proxy ESP32 timeout (30s) - ESP32 surchargé')
      return NextResponse.json(
        { error: 'ESP32 timeout', message: 'ESP32 is overloaded (30s timeout)' },
        { status: 504 }
      )
    }
    
    console.error('❌ Proxy Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to connect to ESP32', message: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { channel, state } = await request.json()
    console.log('🌐 Proxy ESP32: Changement canal', { channel, state })
    
    // Timeout pour les commandes aussi
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s pour les commandes
    
    const response = await fetch(`http://192.168.178.46/setChannel?channel=${channel}&state=${state}`, {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'ESP32 command failed', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('⏰ Proxy ESP32 command timeout (5s)')
      return NextResponse.json(
        { error: 'ESP32 command timeout', message: 'Command timed out after 5 seconds' },
        { status: 504 }
      )
    }
    
    console.error('❌ Proxy POST Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to send command to ESP32', message: error.message },
      { status: 500 }
    )
  }
}