// Configuration modifiée pour accès distant via MQTT uniquement
import { ESP32_CONFIG } from '../config/esp32'

// Détecter si on est en mode distant (cloud)
const isRemoteMode = process.env.NEXT_PUBLIC_ESP32_MODE === 'mqtt-only' || 
                     typeof window !== 'undefined' && window.location.hostname !== 'localhost'

// Configuration adaptée pour mode distant
export const REMOTE_CONFIG = {
  ...ESP32_CONFIG,
  // Désactiver les requêtes HTTP directes en mode distant
  ENABLE_HTTP: !isRemoteMode,
  
  // Privilégier MQTT en mode distant
  MQTT_ENABLED: true,
  MQTT_ONLY: isRemoteMode,
  
  // Configuration MQTT pour WebSocket (accessible depuis internet)
  MQTT_BROKER: process.env.NEXT_PUBLIC_MQTT_BROKER || 'broker.hivemq.com',
  MQTT_PORT: parseInt(process.env.NEXT_PUBLIC_MQTT_PORT || '8000'),
  MQTT_USE_SSL: false,
  MQTT_PATH: '/mqtt',
  
  // Timeouts plus élevés pour connexions internet
  MQTT_TIMEOUT: 10000,
  MQTT_KEEPALIVE: 60,
  
  // Topics MQTT (identiques à l'ESP32)
  MQTT_TOPICS: {
    status: 'esp32/relay/status',
    command: 'esp32/relay/command', 
    schedule: 'esp32/relay/schedule',
    heartbeat: 'esp32/relay/heartbeat'
  }
}

console.log('🌐 Remote Config:', {
  isRemoteMode,
  mqttOnly: REMOTE_CONFIG.MQTT_ONLY,
  broker: REMOTE_CONFIG.MQTT_BROKER,
  port: REMOTE_CONFIG.MQTT_PORT
})