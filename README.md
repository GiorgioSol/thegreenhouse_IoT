# 🌱 The Green House - Système de Contrôle IoT Automatisé

[![ESP32](https://img.shields.io/badge/ESP32-S3-blue)](https://espressif.com/)
[![MQTT](https://img.shields.io/badge/MQTT-Protocol-green)](https://mqtt.org/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![RS485](https://img.shields.io/badge/RS485-Modbus-red)](https://en.wikipedia.org/wiki/Modbus)

## 📋 Description

Système IoT complet pour l'automatisation et le monitoring d'une serre connectée. Contrôle à distance via application web progressive (PWA) optimisée mobile, avec monitoring énergétique en temps réel et programmation horaire automatique.

**🎯 Projet développé pour démontrer des compétences en IoT industriel, développement embarqué ESP32, et interfaces web modernes.**

## ✨ Fonctionnalités Principales

### 🎛️ Contrôle des Relais
- **6 relais individuels** contrôlés via ESP32-S3 Waveshare
- **Interface web intuitive** optimisée iPhone 13 mini
- **États temps réel** avec synchronisation MQTT bidirectionnelle
- **Programmation horaire** automatique (cycles jour/nuit)
- **Sauvegarde EEPROM** des configurations

### ⚡ Monitoring Énergétique RS485
- **Compteur électrique triphasé** RDZD5-MID 100A Modbus RTU
- **Mesures temps réel** : tensions L-N et L-L, courants, puissances
- **Données complètes** : énergie active/réactive, facteur de puissance
- **Communication RS485** via UART1 (GPIO17/18)

### 📱 Progressive Web App (PWA)
- **Installation native** sur écran d'accueil iOS/Android
- **Interface responsive** sans scrolling (optimisée iPhone 13 mini)
- **Mode hors ligne** avec Service Worker
- **3 onglets** : Relais, Compteur électrique, Horaires
- **Temps réel** affiché en permanence

### 🌐 Connectivité IoT Avancée
- **WiFi** intégré ESP32-S3 avec reconnexion automatique
- **MQTT over WebSocket** (broker.hivemq.com:8884)
- **Communication bidirectionnelle** JSON temps réel
- **Fallback HTTP** automatique en cas de problème MQTT

## 🛠️ Stack Technique Complet

### Hardware & Embarqué
```
ESP32-S3-Relay-6CH (Waveshare) + RS485 + Compteur Modbus
├── Microcontrôleur: ESP32-S3 (240MHz, WiFi, 512KB RAM)
├── Relais: 6x 10A/250VAC (GPIO 1,2,41,42,45,46)
├── RS485: Transceiver intégré (GPIO 17/18)
└── Compteur: RDZD5-MID 100A triphasé Modbus RTU
```

### Firmware ESP32 (C++ Arduino)
```
PlatformIO + Arduino Framework
├── WiFi & MQTT: PubSubClient, ArduinoJson
├── Modbus RTU: Driver custom IEEE754 32-bit
├── Web Server: ESP32WebServer intégré
└── Persistance: Preferences (EEPROM)
```

### Application Web (JavaScript Vanilla)
```
PWA Mobile-First
├── Frontend: HTML5/CSS3/JS (pas de framework)
├── Communication: MQTT.js WebSocket
├── PWA: Service Worker + Web App Manifest
└── UI: Responsive design iPhone optimisé
```

### Protocoles & Standards
```
Communication Industrielle
├── MQTT: Topics JSON standardisés
├── Modbus RTU: FC04, CRC16, IEEE754 floats
├── WebSocket: Temps réel bidirectionnel
└── HTTP: API REST de fallback
```

## 📁 Architecture Projet

```
The Green House/
├── 📱 ESP32-S3-Relay-6CH-MQTT/        # Firmware embarqué
│   ├── src/
│   │   ├── main.cpp                    # Contrôleur principal
│   │   ├── ModbusMeter.h/.cpp          # Driver RS485 Modbus
│   │   └── [web interface intégrée]
│   ├── platformio.ini                  # Config PlatformIO
│   └── README.md                       # Doc technique firmware
│
├── 🌐 ESP32_Remote_Monitor/            # Application PWA
│   └── public/
│       ├── app-pro.html               # Interface principale optimisée
│       ├── controller.html            # Version basique
│       ├── manifest.json              # Configuration PWA
│       ├── sw.js                      # Service Worker
│       └── [pages debug/test]
│
├── 🛠️ Scripts utilitaires/
│   ├── setup_*.sh                     # Scripts déploiement
│   ├── test_mqtt.py                   # Tests MQTT Python
│   └── esp32_debug.html               # Interface debug
│
└── 📚 Documentation/
    ├── README.md                       # Documentation principale
    └── [captures d'écran]
```

## 🚀 Installation & Déploiement

### 1️⃣ Configuration ESP32

```bash
# Clone et navigation
git clone [votre-repository-url]
cd "The Green House/ESP32-S3-Relay-6CH-MQTT"

# Configuration réseau (src/main.cpp)
const char* ssid = "VOTRE_WIFI_SSID";
const char* password = "VOTRE_WIFI_PASSWORD";

# Build et upload firmware
pio run --target upload

# Monitoring série
pio device monitor
```

### 2️⃣ Lancement Application PWA

```bash
# Serveur de développement
cd "ESP32_Remote_Monitor/public"
python3 -m http.server 9000 --bind 0.0.0.0

# Accès depuis mobile
# http://[IP-ESP32]:9000/app-pro.html
```

### 3️⃣ Installation PWA Mobile

```
iPhone Safari:
1. Ouvrir http://[IP]:9000/app-pro.html
2. Partager 📤 → "Ajouter à l'écran d'accueil"
3. Confirmer → Icône native créée
```

## ⚙️ Configuration Matérielle

### Relais ESP32-S3 (Waveshare)
| Canal | GPIO | Fonction       | Mode Défaut |
|-------|------|----------------|-------------|
| CH1   | 1    | 💡 Lampe 1     | AUTO        |
| CH2   | 2    | ⚡ Relais 2     | OFF         |
| CH3   | 41   | 💡 Lampe 2     | AUTO        |
| CH4   | 42   | ⚡ Relais 4     | OFF         |
| CH5   | 45   | 🌡️ Climat      | ON          |
| CH6   | 46   | ⚡ Relais 6     | OFF         |

### Interface RS485 Modbus
```
ESP32 UART1 ←→ RS485 Transceiver ←→ Compteur RDZD5-MID
GPIO17 (TX) → A+ (RS485)
GPIO18 (RX) ← B- (RS485)

Paramètres Modbus:
- Adresse esclave: 1
- Vitesse: 9600 baud, 8N1
- Function Code: 04 (Read Input Registers)
- Format: IEEE754 32-bit float
```

## 📡 Protocole MQTT & API

### Topics MQTT Principaux
```json
// Commande relais individuel
"esp32/relay/command": {
  "channel": 0,     // 0-5 (index relais)
  "state": 2        // 0=OFF, 1=AUTO, 2=ON
}

// Statut complet relais
"esp32/relay/status": {
  "channels": [
    {"active": true},   // CH1 état physique
    {"active": false},  // CH2 état physique
    // ... channels 2-5
  ]
}

// Configuration horaires automatiques
"esp32/relay/schedule": {
  "start_hour": 22,    // Heure activation (22h)
  "start_minute": 0,
  "end_hour": 10,      // Heure désactivation (10h)
  "end_minute": 0
}

// Données compteur électrique (30s)
"esp32/meter/data": {
  "voltages_LN": {"v1": 230.1, "v2": 229.8, "v3": 230.5},
  "currents": {"i1": 2.45, "i2": 1.87, "i3": 3.21},
  "powers": {"p1_W": 560, "p2_W": 430, "pTotal_W": 1245},
  "frequency_Hz": 50.02,
  "energy_import_kWh": 1247.5
}
```

### API HTTP Intégrée
```
GET  /           → Interface web intégrée
GET  /status     → JSON état relais
GET  /relay?ch=0&state=2  → Commande directe relais
POST /config     → Configuration système
```

## 📊 Architecture Système Complète

```
┌─────────────────────────┐    WiFi/MQTT     ┌─────────────────────────┐
│       📱 iPhone PWA      │◄─────────────────►│     🔧 ESP32-S3         │
│   Safari + Service      │    WebSocket      │   Firmware C++          │
│   Worker + Manifest     │    JSON Topics    │   MQTT + Web Server     │
└─────────────────────────┘                   └─────────────────────────┘
                                                        │
                                               ┌────────┴────────┐
                                               │                 │
                                               ▼                 ▼
                                    ┌─────────────────┐ ┌─────────────────┐
                                    │   6x Relais     │ │   RS485 UART    │
                                    │   10A/250VAC    │ │   Modbus RTU    │
                                    │   GPIO 1,2,41,  │ │   GPIO 17/18    │
                                    │   42,45,46      │ │                 │
                                    └─────────────────┘ └─────────────────┘
                                            │                     │
                                            ▼                     ▼
                                    ┌─────────────────┐ ┌─────────────────┐
                                    │  💡🌡️⚡ Équipe-  │ │ ⚡ Compteur 3φ   │
                                    │  ments serre    │ │ RDZD5-MID 100A  │
                                    │  (lampes, etc.) │ │ Modbus esclave  │
                                    └─────────────────┘ └─────────────────┘
```

## 🎯 Démonstration de Compétences

### 💻 Développement Embarqué
- **ESP32 Arduino** avec PlatformIO professionnel
- **Gestion GPIO** et périphériques (UART, WiFi)
- **Protocoles industriels** (Modbus RTU, RS485)
- **Architecture temps réel** et gestion d'événements
- **Optimisation mémoire** et persistance données

### 🌐 Développement Web Moderne
- **Progressive Web App** native mobile complète
- **JavaScript ES6+** vanilla sans frameworks (performance)
- **MQTT WebSocket** communication temps réel
- **Service Worker** et cache intelligent
- **Responsive Design** mobile-first

### ⚙️ Ingénierie Système IoT
- **Architecture end-to-end** complète
- **Intégration hardware/software** complexe
- **Protocoles industriels** standards (Modbus, MQTT)
- **Monitoring énergétique** précis
- **Interface utilisateur** intuitive et robuste

### 🔧 Méthodologies & Outils
- **Git** versioning et collaboration
- **PlatformIO** développement embarqué moderne
- **Tests progressifs** et débogage méthodique
- **Documentation technique** complète
- **Déploiement** et maintenance

## 📈 Métriques de Performance

| Métrique | Valeur | Description |
|----------|--------|-------------|
| **Latence MQTT** | < 100ms | Commande → Action relais |
| **Fréquence monitoring** | 30s | Lecture compteur RS485 |
| **Temps de boot** | < 10s | ESP32 → WiFi + MQTT ready |
| **Consommation** | < 2W | ESP32 + relais au repos |
| **Compatibilité mobile** | iOS 14+, Android 8+ | PWA native |
| **Débit Modbus** | 9600 baud | Communication compteur |

## 🎨 Interface Utilisateur

### Capture Mobile (iPhone 13 mini)
```
┌─────────────────────────────────┐
│ 🌱 The Green House       14:25  │ ← Header fixe + heure
│ ┌─────────────────────────────┐ │
│ │ [Relais] [Compteur] [Horai] │ │ ← Tabs navigation
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 💡 Lampe 1    [ON ] [ÉTEINDRE] │ ← Grille 2x3 relais
│ ⚡ Relais 2   [OFF] [ALLUMER ] │   sans scrolling
│ 💡 Lampe 2    [ON ] [ÉTEINDRE] │
│ ⚡ Relais 4   [OFF] [ALLUMER ] │
│ 🌡️ Climat      [ON ] [ÉTEINDRE] │
│ ⚡ Relais 6   [OFF] [ALLUMER ] │
└─────────────────────────────────┘
```

## 🤝 Utilisation & Contexte

Ce projet a été développé comme **démonstration technique complète** des compétences requises pour l'**ingénierie IoT industrielle** moderne :

- **Systèmes embarqués** ESP32 en environnement professionnel
- **Protocoles industriels** (Modbus, MQTT) pour Industry 4.0
- **Interfaces utilisateur** modernes et mobiles
- **Architecture système** robuste et scalable

Parfaitement adapté pour un **portfolio technique** démontrant une expertise **full-stack IoT**.

## 📄 Licence

**MIT License** - Libre d'utilisation pour l'éducation et la démonstration professionnelle.

## 📞 Contact Développeur

**Ingénieur IoT & Systèmes Embarqués**  
📧 Email : [votre.email@example.com]  
💼 LinkedIn : [votre-profil-linkedin]  
🌐 Portfolio : [votre-portfolio-url]

---

> *"Développé avec passion pour l'automatisation intelligente et l'IoT industriel"* 🌱⚡  
> **Candidature Dassault Systèmes** - Démonstration compétences techniques IoT


## 🚀 Démarrage Rapide

### 1. Interface Web
```bash
cd ESP32_Remote_Monitor
npm install
npm run dev
```
→ Application disponible sur http://localhost:3000

### 2. Flash Firmware
1. Ouvrir `ESP32-S3-Relay-6CH/ESP32-S3-Relay-6CH-MQTT/ESP32-S3-Relay-6CH-MQTT.ino`
2. Configurer WiFi dans le code
3. Flasher sur ESP32-S3-Relay-6CH

### 3. Configuration
- ESP32 accessible via `http://192.168.x.x/`
- MQTT Broker : `broker.hivemq.com:1883`
- Topics : `esp32/relay/*`

## 🔧 Technologies

### Frontend
- **Next.js** 16.2.4 + Turbopack
- **React** 19.2.5
- **TypeScript** 5.x
- **Tailwind CSS** 3.x
- **MQTT.js** 5.3.4

### Backend/Firmware
- **Arduino Framework**
- **ESP32-S3** microcontroller
- **WiFi** + **MQTT** connectivity
- **PubSubClient** + **ArduinoJson**

## 🌍 Accès distant
- Configuration SSH tunnel via serveo.net
- Accès sécurisé depuis internet
- Interface mobile-friendly

### Configuration réseau
- WiFi : "VOTRE_WIFI_SSID"
- IP ESP32 : "VOTRE_IP_LOCALE_ESP32"
- MQTT : broker.hivemq.com:1883 (ESP32) / :8000 (WebSocket)

**Créé le 22 avril 2026** - Système complet de gestion domotique ESP32 🏡✨