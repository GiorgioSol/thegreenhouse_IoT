// Configuration ESP32 pour l'application web
export const ESP32_CONFIG = {
  BASE_URL: 'http://192.168.178.46',
  TIMEOUT: 30000,  // Timeout augmenté pour correspondre aux performances ESP32
  POLL_INTERVAL: 15000,  // Polling très espacé (15 secondes)
  RETRY_DELAY: 5000,  // Délai entre tentatives
  MAX_RETRIES: 3,
  
  // Configuration MQTT
  MQTT_ENABLED: true,  // Activer MQTT par défaut
  MQTT_BROKER: 'broker.hivemq.com',
  MQTT_PORT: 1883,  // Port MQTT standard
  MQTT_USE_SSL: false
}

// Test de connectivité pour diagnostics
export async function testESP32Connection(): Promise<boolean> {
  try {
    const response = await fetch(`${ESP32_CONFIG.BASE_URL}/status`, {
      mode: 'cors',
      cache: 'no-cache',
      signal: AbortSignal.timeout(ESP32_CONFIG.TIMEOUT)
    })
    return response.ok
  } catch (error) {
    console.error('Test ESP32 failed:', error)
    return false
  }
}