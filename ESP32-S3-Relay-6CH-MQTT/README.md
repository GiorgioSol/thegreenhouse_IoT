# 🔌 ESP32-S3-Relay-6CH-MQTT Firmware

## 📋 Description
Firmware pour carte ESP32-S3-Relay-6CH de Waveshare avec support MQTT et interface web intégrée.

## 🔧 Installation et Configuration

### Méthode recommandée : PlatformIO
1. Installer [VS Code](https://code.visualstudio.com/)  
2. Installer l'extension [PlatformIO IDE](https://platformio.org/install/ide?install=vscode)
3. Ouvrir ce dossier dans PlatformIO
4. Compiler et téléverser :
   ```bash
   pio run --target upload
   ```

### Méthode alternative : Arduino IDE
1. Installer [Arduino IDE 2.0+](https://www.arduino.cc/en/software)
2. Ajouter le package ESP32 :
   - File → Preferences → Additional Board Manager URLs
   - Ajouter : `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Installer les bibliothèques requises (voir section suivante)
4. Ouvrir `ESP32-S3-Relay-6CH-MQTT.ino` et téléverser

## 📦 Dépendances

### Bibliothèques ESP32 (incluses)
- ✅ **WiFi.h** - Connectivité Wi-Fi
- ✅ **WebServer.h** - Serveur HTTP intégré  
- ✅ **Preferences.h** - Sauvegarde EEPROM
- ✅ **Wire.h** - Communication I2C
- ✅ **time.h** - Gestion du temps

### Bibliothèques externes
- ✅ **PubSubClient** v2.8+ - Client MQTT
- ✅ **ArduinoJson** v7.0+ - Parsing JSON

### Installation manuelle (Arduino IDE)
```bash
# Dans Arduino IDE : Tools → Manage Libraries
# Rechercher et installer :
- PubSubClient by Nick O'Leary
- ArduinoJson by Benoit Blanchon
```

## ⚙️ Configuration

### Wi-Fi (à modifier dans le code)
```cpp
const char* ssid = "VOTRE_SSID";
const char* password = "VOTRE_MOT_DE_PASSE"; 
```

### MQTT
```cpp
const char* mqtt_server = "broker.hivemq.com";  // Serveur MQTT
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32-Relay-Controller-001";
```

### Topics MQTT
- **Status** : `esp32/relay/status`
- **Commands** : `esp32/relay/command`  
- **Schedule** : `esp32/relay/schedule`
- **Heartbeat** : `esp32/relay/heartbeat`

## 🔌 Pins ESP32-S3-Relay-6CH
```
CH1 → Pin 2   |   CH4 → Pin 5
CH2 → Pin 3   |   CH5 → Pin 6  
CH3 → Pin 4   |   CH6 → Pin 7
I2C SDA → Pin 8 | SCL → Pin 9
```

## 🚀 Utilisation

### Interface Web
- **URL** : `http://192.168.x.x/` (IP affiché dans le moniteur série)
- **Endpoints** :
  - `/status` - État des relais
  - `/toggle?channel=X` - Basculer relais X
  - `/config` - Configuration système

### Commandes MQTT
```json
// Contrôle individuel
{"channel": 1, "state": "ON"}
{"channel": 2, "state": "OFF"}  
{"channel": 3, "state": "AUTO"}

// Programmation horaire
{"start_hour": 22, "start_minute": 0, "end_hour": 10, "end_minute": 0}
```

## 📈 Surveillance
- **Heartbeat MQTT** toutes les 30 secondes
- **Status web** en temps réel  
- **LED status** sur la carte
- **Moniteur série** à 115200 bauds

---
*Généré automatiquement pour le projet The Green House*