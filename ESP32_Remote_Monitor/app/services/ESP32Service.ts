import { ESP32Status, RelayChannel, SystemInfo, WifiInfo, ScheduleConfig, ChannelState, ChannelNames, MeterData } from '../types/ESP32Types'
import { ESP32_CONFIG } from '../config/esp32'

class ESP32ServiceClass {
  private baseUrl: string
  private proxyUrl: string = '/api/esp32'
  private timeout: number
  private useProxy: boolean = true
  private cache: { data: any; timestamp: number } | null = null
  private readonly CACHE_DURATION = 8000 // Cache pendant 8 secondes
  private isRequesting = false

  constructor() {
    this.baseUrl = ESP32_CONFIG.BASE_URL
    this.timeout = ESP32_CONFIG.TIMEOUT
    console.log('🔧 ESP32Service initialized:', { 
      baseUrl: this.baseUrl, 
      proxyUrl: this.proxyUrl,
      timeout: this.timeout,
      useProxy: this.useProxy,
      cacheDuration: this.CACHE_DURATION
    })
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const directUrl = `${this.baseUrl}${endpoint}`
    const proxyUrl = endpoint === '/status' ? this.proxyUrl : `${this.proxyUrl}${endpoint}`
    
    // Utiliser le proxy en priorité (plus fiable dans le navigateur)
    if (this.useProxy) {
      try {
        console.log(`🔄 ESP32 Proxy Request: ${proxyUrl}`)
        return await this.fetchWithTimeout(proxyUrl, {
          ...options,
          mode: undefined, // Pas de CORS pour les requêtes internes
        })
      } catch (error) {
        console.log('⚠️ Proxy échoué, tentative connexion directe...')
        this.useProxy = false
      }
    }
    
    // Connexion directe en fallback
    console.log(`🌐 ESP32 Direct Request: ${directUrl}`)
    return await this.fetchWithTimeout(directUrl, options)
  }

  private async fetchWithTimeout<T>(url: string, options: RequestInit): Promise<T> {
    console.log(`🌐 Fetch: ${url}`)
    console.log('🌐 Options:', options)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Timeout après ${this.timeout}ms`)
      controller.abort()
    }, this.timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          ...options.headers,
        },
        ...options,
      })

      clearTimeout(timeoutId)
      console.log(`✅ Response: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
      }

      const text = await response.text()
      console.log('📄 Raw Response:', text)
      
      if (!text) {
        throw new Error('Empty response')
      }

      const data = JSON.parse(text)
      console.log('📊 Parsed Data:', data)
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`🔴 Timeout après ${this.timeout}ms`)
          throw new Error(`Timeout de connexion (${this.timeout/1000}s)`)
        } else if (error.message.includes('Failed to fetch')) {
          console.error('🔴 Network Error:', error)
          throw new Error('Impossible de se connecter (vérifiez le réseau)')
        } else {
          console.error('🔴 Error:', error)
          throw error
        }
      }
      
      console.error('🔴 Unknown Error:', error)
      throw new Error('Erreur inconnue lors de la connexion')
    }
  }

  async getStatus(): Promise<ESP32Status> {
    try {
      // Vérifier le cache d'abord
      const now = Date.now()
      let esp32Data: any
      
      if (this.cache && (now - this.cache.timestamp) < this.CACHE_DURATION) {
        console.log('📦 Utilisation du cache ESP32 (fresh)')
        esp32Data = this.cache.data
      } else if (this.isRequesting) {
        console.log('⏳ Requête ESP32 en cours, utilisation du cache si disponible')
        if (this.cache) {
          console.log('📦 Utilisation du cache ESP32 (stale)')
          esp32Data = this.cache.data
        } else {
          throw new Error('Requête ESP32 en cours et pas de cache disponible')
        }
      } else {
        // Faire une nouvelle requête
        this.isRequesting = true
        console.log('🔄 Nouvelle requête ESP32...')
        
        try {
          const response = await this.request<any>('/status')
          console.log('Statut ESP32 reçu:', response)
          
          // Mettre à jour le cache
          this.cache = {
            data: response,
            timestamp: now
          }
          
          console.log('✅ Cache ESP32 mis à jour')
          esp32Data = response
        } finally {
          this.isRequesting = false
        }
      }
      
      // Créer les canaux basés sur les données réelles de l'ESP32
      const channels: RelayChannel[] = esp32Data.channels 
        ? esp32Data.channels.map((channel: any) => ({
            id: channel.id,
            name: ChannelNames[channel.id as keyof typeof ChannelNames] || `Canal ${channel.id + 1}`,
            state: channel.state,
            isActive: channel.active,
            lastChanged: new Date().toISOString()
          }))
        : Array.from({ length: 6 }, (_, i) => ({
            id: i,
            name: ChannelNames[i as keyof typeof ChannelNames] || `Canal ${i + 1}`,
            state: i === 0 || i === 2 ? 2 : (i === 4 ? 1 : 0), // CH1&CH3=AUTO, CH5=ON, autres=OFF
            isActive: esp32Data.relaysActive || false,
            lastChanged: new Date().toISOString()
          }))

      return {
        channels,
        currentTime: esp32Data.currentTime || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        scheduleStart: `${esp32Data.startHour || 22}:${String(esp32Data.startMinute || 0).padStart(2, '0')}`,
        scheduleEnd: `${esp32Data.endHour || 10}:${String(esp32Data.endMinute || 0).padStart(2, '0')}`,
        isScheduleActive: this.isInSchedule(
          `${esp32Data.startHour || 22}:${String(esp32Data.startMinute || 0).padStart(2, '0')}`,
          `${esp32Data.endHour || 10}:${String(esp32Data.endMinute || 0).padStart(2, '0')}`
        ),
        systemInfo: {
          uptime: esp32Data.uptime || 0,
          freeHeap: esp32Data.freeHeap || 100000,
          totalHeap: 320000,
          chipModel: 'ESP32-S3',
          cpuFreq: 240,
          temperature: 35 + Math.floor(Math.random() * 10)
        },
        wifiInfo: {
          ssid: 'ESP32-Network',
          ip: '192.168.178.46',
          rssi: -45,
          mac: '00:00:00:00:00:00',
          gatewayIP: '192.168.178.1'
        },
        lastUpdate: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Erreur getStatus:', error)
      
      // En cas d'erreur, essayer le cache même s'il est vieux
      if (this.cache) {
        console.log('🔄 Fallback vers cache ESP32 (ancien)')
        const esp32Data = this.cache.data
        
        // Retourner les données cachées avec indication de déconnexion
        const channels: RelayChannel[] = esp32Data.channels?.map((channel: any) => ({
          id: channel.id,
          name: ChannelNames[channel.id as keyof typeof ChannelNames] || `Canal ${channel.id + 1}`,
          state: channel.state,
          isActive: false, // Indiquer déconnexion
          lastChanged: new Date().toISOString()
        })) || []
        
        return {
          channels,
          currentTime: 'Déconnecté',
          scheduleStart: `${esp32Data.startHour || 22}:${String(esp32Data.startMinute || 0).padStart(2, '0')}`,
          scheduleEnd: `${esp32Data.endHour || 10}:${String(esp32Data.endMinute || 0).padStart(2, '0')}`,
          isScheduleActive: false,
          systemInfo: {
            uptime: esp32Data.uptime || 0,
            freeHeap: esp32Data.freeHeap || 0,
            totalHeap: 320000,
            chipModel: 'ESP32-S3',
            cpuFreq: 240,
            temperature: 0
          },
          wifiInfo: {
            ssid: 'Déconnecté',
            ip: '192.168.178.46',
            rssi: -100,
            mac: '00:00:00:00:00:00',
            gatewayIP: '192.168.178.1'
          },
          lastUpdate: new Date().toISOString()
        }
      }
      
      throw new Error('Impossible de récupérer le statut de l\'ESP32')
    }
  }

  private async parseHtmlStatus(): Promise<any> {
    // Simuler les données pour le développement
    // Dans un cas réel, on parserait le HTML ou ajouterait une API JSON à l'ESP32
    return {
      channelStates: [2, 0, 2, 0, 1, 0], // CH1=AUTO, CH2=OFF, CH3=AUTO, CH4=OFF, CH5=ON, CH6=OFF
      channelActive: [true, false, true, false, true, false],
      scheduleStart: '22:00',
      scheduleEnd: '10:00'
    }
  }

  async setChannel(channelId: number, state: ChannelState): Promise<void> {
    try {
      console.log(`🔧 Changement canal CH${channelId + 1} vers état ${state}`)
      
      if (this.useProxy) {
        // Utiliser l'API proxy
        const response = await fetch(this.proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: channelId, state })
        })
        
        if (!response.ok) {
          throw new Error(`Proxy error: ${response.status}`)
        }
      } else {
        // Essayer la connexion directe
        await this.request(`/setChannel?channel=${channelId}&state=${state}`, {
          method: 'GET'
        })
      }
      
      // Invalider le cache après une commande réussie
      this.cache = null
      console.log('🗑️ Cache invalidé après setChannel')
      
      console.log(`✅ Canal CH${channelId + 1} changé vers ${state}`)
    } catch (error) {
      console.error(`❌ Erreur setChannel CH${channelId + 1}:`, error)
      throw new Error(`Impossible de changer l'état du canal CH${channelId + 1}`)
    }
  }

  async setSchedule(config: ScheduleConfig): Promise<void> {
    try {
      console.log('🔧 Configuration horaires:', config)
      
      // Utiliser la méthode request qui gère automatiquement proxy/direct
      await this.request('/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          start_time: config.startTime,
          end_time: config.endTime,
          enabled: config.enabled ? '1' : '0'
        })
      })
      
      // Invalider le cache après une commande réussie
      this.cache = null
      console.log('🗑️ Cache invalidé après setSchedule')
      
      console.log('✅ Horaires configurés')
    } catch (error) {
      console.error('❌ Erreur setSchedule:', error)
      throw new Error('Impossible de configurer les horaires')
    }
  }

  async getMeterData(): Promise<MeterData | null> {
    try {
      const response = await fetch('/api/esp32/meter', { cache: 'no-store' })
      if (!response.ok) return null
      const data = await response.json()
      if (data.error) return null
      return data as MeterData
    } catch (error) {
      console.error('❌ Erreur getMeterData:', error)
      return null
    }
  }

  async getSystemInfo(): Promise<SystemInfo> {
    try {
      // L'ESP32 actuel n'a pas d'endpoint dédié, simuler pour le moment
      return {
        uptime: Math.floor(Date.now() / 1000),
        freeHeap: 100000 + Math.floor(Math.random() * 50000),
        totalHeap: 320000,
        chipModel: 'ESP32-S3',
        cpuFreq: 240,
        temperature: 35 + Math.floor(Math.random() * 10)
      }
    } catch (error) {
      console.error('Erreur getSystemInfo:', error)
      throw new Error('Impossible de récupérer les informations système')
    }
  }

  private isInSchedule(start: string, end: string): boolean {
    // Vérification de sécurité
    if (!start || !end) {
      return false
    }

    const now = new Date()
    const currentTime = now.getHours() * 100 + now.getMinutes()
    
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    
    const startTime = startHour * 100 + startMin
    const endTime = endHour * 100 + endMin
    
    // Gérer le cas où l'horaire traverse minuit (22:00 → 10:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime
    } else {
      return currentTime >= startTime && currentTime <= endTime
    }
  }

  // Test de connexion
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export const ESP32Service = new ESP32ServiceClass()