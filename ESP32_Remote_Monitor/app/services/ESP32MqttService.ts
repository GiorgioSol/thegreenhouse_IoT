import { ESP32Status, RelayChannel, ChannelState, ChannelNames } from '../types/ESP32Types'
import { ESP32_CONFIG } from '../config/esp32'

// Import dynamique de MQTT pour éviter les erreurs SSR
let mqtt: any = null

interface MqttMessage {
  topic: string
  message: any
}

class ESP32MqttService {
  private client: any = null
  private isConnecting = false
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectInterval: NodeJS.Timeout | null = null
  private connectionTimeout: NodeJS.Timeout | null = null
  private isDisabled = false
  private statusCallback: ((status: ESP32Status) => void) | null = null
  private connectionCallback: ((connected: boolean) => void) | null = null
  private lastStatus: ESP32Status | null = null

  // Topics MQTT (même que l'ESP32)
  private readonly topics = {
    status: 'esp32/relay/status',
    command: 'esp32/relay/command',
    schedule: 'esp32/relay/schedule',
    heartbeat: 'esp32/relay/heartbeat'
  }

  // Configuration MQTT
  private readonly brokerOptions = {
    hostname: 'broker.hivemq.com',
    port: 8000,
    protocol: 'ws' as const,
    path: '/mqtt',
    clientId: `ESP32-WebClient-${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    connectTimeout: 5000, // Réduit à 5s
    keepalive: 30,
    reconnectPeriod: 0, // Désactiver la reconnexion automatique
    will: {
      topic: 'esp32/webclient/status',
      payload: JSON.stringify({ status: 'offline', timestamp: Date.now() }),
      qos: 0,
      retain: true
    }
  }

  constructor() {
    console.log('🔧 ESP32MqttService initialized')
    this.initializeMqtt()
  }

  private async initializeMqtt() {
    try {
      // Import dynamique pour éviter les erreurs SSR
      if (typeof window !== 'undefined') {
        const mqttModule = await import('mqtt')
        mqtt = mqttModule.default
        console.log('📦 MQTT library loaded')
      }
    } catch (error) {
      console.error('❌ Error loading MQTT:', error)
    }
  }

  async connect(): Promise<boolean> {
    if (this.isDisabled) {
      console.log('🚫 MQTT disabled, skipping connection')
      return false
    }
    
    if (this.isConnecting || this.isConnected) {
      console.log('🔄 Already connecting or connected')
      return this.isConnected
    }

    if (!mqtt) {
      console.log('⏳ Waiting for MQTT library...')
      await this.initializeMqtt()
      if (!mqtt) {
        console.error('❌ MQTT library not available')
        return false
      }
    }

    this.isConnecting = true
    console.log('🔌 Connecting to MQTT broker...')

    return new Promise((resolve) => {
      // Timeout pour éviter les connexions qui trainent (5s)
      this.connectionTimeout = setTimeout(() => {
        console.log('⏱️ MQTT Connection timeout (5s)')
        this.isConnected = false
        this.isConnecting = false
        this.isDisabled = true // Désactiver MQTT si timeout
        
        if (this.client) {
          this.client.end(true)
        }
        
        resolve(false)
      }, 5000)
      
      try {
        const brokerUrl = `${this.brokerOptions.protocol}://${this.brokerOptions.hostname}:${this.brokerOptions.port}${this.brokerOptions.path}`
        console.log('🌐 Broker URL:', brokerUrl)

        this.client = mqtt.connect(brokerUrl, this.brokerOptions)

        this.client.on('connect', () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }
          
          console.log('✅ MQTT Connected!')
          this.isConnected = true
          this.isConnecting = false
          this.reconnectAttempts = 0

          // S'abonner aux topics
          this.client.subscribe(this.topics.status, { qos: 0 })
          this.client.subscribe(this.topics.heartbeat, { qos: 0 })
          
          console.log('📡 Subscribed to topics:', [this.topics.status, this.topics.heartbeat])

          if (this.connectionCallback) {
            this.connectionCallback(true)
          }

          resolve(true)
        })

        this.client.on('message', (topic: string, message: Buffer) => {
          this.handleMessage(topic, message)
        })

        this.client.on('error', (error: Error) => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }
          
          console.error('❌ MQTT Error:', error.message)
          this.isConnected = false
          this.isConnecting = false
          
          // Désactiver immédiatement MQTT si timeout ou erreur de connexion
          if (error.message.includes('connack timeout') || 
              error.message.includes('connect ECONNREFUSED') ||
              error.message.includes('Load failed')) {
            console.log('🚫 MQTT broker unavailable - disabling MQTT service')
            this.isDisabled = true
          }
          
          if (this.connectionCallback) {
            this.connectionCallback(false)
          }
          
          resolve(false)
        })

        this.client.on('close', () => {
          console.log('📴 MQTT Connection closed')
          this.isConnected = false
          this.isConnecting = false
          
          if (this.connectionCallback) {
            this.connectionCallback(false)
          }
          
          this.handleReconnect()
        })

        this.client.on('offline', () => {
          console.log('📴 MQTT Offline')
          this.isConnected = false
          
          if (this.connectionCallback) {
            this.connectionCallback(false)
          }
        })

      } catch (error) {
        console.error('❌ MQTT Connection error:', error)
        this.isConnected = false
        this.isConnecting = false
        
        if (this.connectionCallback) {
          this.connectionCallback(false)
        }
        
        resolve(false)
      }
    })
  }

  private handleMessage(topic: string, message: Buffer) {
    try {
      const messageStr = message.toString()
      const data = JSON.parse(messageStr)
      
      console.log(`📨 MQTT [${topic}]:`, data)

      if (topic === this.topics.status) {
        this.handleStatusMessage(data)
      } else if (topic === this.topics.heartbeat) {
        console.log('💓 Heartbeat received:', data)
      }
    } catch (error) {
      console.error('❌ Error parsing MQTT message:', error)
    }
  }

  private handleStatusMessage(data: any) {
    try {
      // Convertir les données ESP32 en format ESP32Status
      const channels: RelayChannel[] = data.channels?.map((channel: any) => ({
        id: channel.id,
        name: ChannelNames[channel.id as keyof typeof ChannelNames] || `Canal ${channel.id + 1}`,
        state: channel.state,
        isActive: channel.active,
        lastChanged: new Date().toISOString()
      })) || []

      const status: ESP32Status = {
        channels,
        currentTime: data.currentTime || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        scheduleStart: `${data.startHour || 22}:${String(data.startMinute || 0).padStart(2, '0')}`,
        scheduleEnd: `${data.endHour || 10}:${String(data.endMinute || 0).padStart(2, '0')}`,
        isScheduleActive: this.isInSchedule(
          `${data.startHour || 22}:${String(data.startMinute || 0).padStart(2, '0')}`,
          `${data.endHour || 10}:${String(data.endMinute || 0).padStart(2, '0')}`
        ),
        systemInfo: {
          uptime: data.uptime || 0,
          freeHeap: data.freeHeap || 0,
          totalHeap: 320000,
          chipModel: 'ESP32-S3',
          cpuFreq: 240,
          temperature: 35 + Math.floor(Math.random() * 10)
        },
        wifiInfo: {
          ssid: 'ESP32-Network-MQTT',
          ip: '192.168.178.46',
          rssi: -45,
          mac: '00:00:00:00:00:00',
          gatewayIP: '192.168.178.1'
        },
        lastUpdate: new Date().toISOString()
      }

      this.lastStatus = status

      if (this.statusCallback) {
        this.statusCallback(status)
      }
    } catch (error) {
      console.error('❌ Error processing status message:', error)
    }
  }

  private isInSchedule(startTime: string, endTime: string): boolean {
    // Vérification de sécurité
    if (!startTime || !endTime) {
      return false
    }

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    } else {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    }
  }

  private handleReconnect() {
    if (this.isDisabled) {
      console.log('🚫 MQTT disabled, stopping reconnection attempts')
      return
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max MQTT reconnection attempts reached, disabling MQTT')
      this.isDisabled = true
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 MQTT reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in 10s...`)

    this.reconnectInterval = setTimeout(() => {
      if (!this.isConnected && !this.isDisabled) {
        this.connect()
      }
    }, 10000) // Augmenté à 10s
  }

  async setChannel(channelId: number, state: ChannelState): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('MQTT not connected')
    }

    try {
      const command = {
        channel: channelId,
        state: state,
        timestamp: Date.now()
      }

      console.log(`🔧 Sending MQTT command: CH${channelId + 1} -> ${state}`)

      return new Promise((resolve, reject) => {
        this.client.publish(this.topics.command, JSON.stringify(command), { qos: 0 }, (error: Error | null) => {
          if (error) {
            console.error('❌ MQTT Publish error:', error)
            reject(error)
          } else {
            console.log('✅ MQTT Command sent')
            resolve()
          }
        })
      })
    } catch (error) {
      console.error('❌ Error sending MQTT command:', error)
      throw error
    }
  }

  async setSchedule(startTime: string, endTime: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('MQTT not connected')
    }

    try {
      // Vérification de sécurité
      if (!startTime || !endTime) {
        throw new Error('Start time and end time are required')
      }

      const [startHour, startMinute] = startTime.split(':').map(Number)
      const [endHour, endMinute] = endTime.split(':').map(Number)

      const schedule = {
        start_hour: startHour,
        start_minute: startMinute,
        end_hour: endHour,
        end_minute: endMinute,
        timestamp: Date.now()
      }

      console.log('🕐 Sending MQTT schedule:', schedule)

      return new Promise((resolve, reject) => {
        this.client.publish(this.topics.schedule, JSON.stringify(schedule), { qos: 0 }, (error: Error | null) => {
          if (error) {
            console.error('❌ MQTT Schedule error:', error)
            reject(error)
          } else {
            console.log('✅ MQTT Schedule sent')
            resolve()
          }
        })
      })
    } catch (error) {
      console.error('❌ Error sending MQTT schedule:', error)
      throw error
    }
  }

  onStatusUpdate(callback: (status: ESP32Status) => void) {
    this.statusCallback = callback
    
    // Si on a déjà un statut, l'envoyer immédiatement
    if (this.lastStatus) {
      callback(this.lastStatus)
    }
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionCallback = callback
  }

  getLastStatus(): ESP32Status | null {
    return this.lastStatus
  }

  isConnectedToMqtt(): boolean {
    return this.isConnected && !this.isDisabled
  }
  
  isMqttDisabled(): boolean {
    return this.isDisabled
  }

  disconnect() {
    console.log('📴 Disconnecting MQTT...')
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
    
    if (this.client) {
      this.client.end()
      this.isConnected = false
    }
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval)
      this.reconnectInterval = null
    }
  }
  
  enableMqtt() {
    this.isDisabled = false
    this.reconnectAttempts = 0
    console.log('✅ MQTT re-enabled')
  }
  
  disableMqtt() {
    this.isDisabled = true
    this.disconnect()
    console.log('🚫 MQTT disabled')
  }
}

// Export singleton instance
export const esp32MqttService = new ESP32MqttService()