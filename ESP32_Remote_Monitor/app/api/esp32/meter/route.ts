import { NextResponse } from 'next/server'

const ESP32_URL = process.env.ESP32_URL || 'http://192.168.178.46'

export async function GET() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${ESP32_URL}/meter`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'Connection': 'close' },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'ESP32 /meter not reachable', status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'ESP32 meter timeout', connected: false },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to connect to ESP32 meter', message: error.message, connected: false },
      { status: 500 }
    )
  }
}
