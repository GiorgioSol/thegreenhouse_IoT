#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "time.h"
#include "ModbusMeter.h"

// Configuration des pins pour l'ESP32-S3-Relay-6CH de Waveshare
// Source : code officiel Waveshare WS_GPIO.h
#define RELAY_CH1 1   // Pin pour le relais CH1 (GPIO1)
#define RELAY_CH2 2   // Pin pour le relais CH2 (GPIO2)
#define RELAY_CH3 41  // Pin pour le relais CH3 (GPIO41)
#define RELAY_CH4 42  // Pin pour le relais CH4 (GPIO42)
#define RELAY_CH5 45  // Pin pour le relais CH5 (GPIO45)
#define RELAY_CH6 46  // Pin pour le relais CH6 (GPIO46)

// Configuration I2C pour extensions futures
#define SDA_PIN 8     // Pin SDA pour I2C
#define SCL_PIN 9     // Pin SCL pour I2C

// Configuration RS485 / Modbus RTU pour le compteur RDZD5-MID
// La carte Waveshare utilise UART1 (GPIO17=TX, GPIO18=RX)
// Le transceiver RS485 est à direction automatique : pas de pin DE/RE
#define RS485_TX_PIN  17  // UART1 TX → borne A+ RS485 (Waveshare officiel)
#define RS485_RX_PIN  18  // UART1 RX ← borne B- RS485 (Waveshare officiel)
#define MODBUS_SLAVE_ADDR 1   // Adresse esclave par défaut du RDZD5
#define MODBUS_BAUD       9600 // Vitesse par défaut du RDZD5

// Configuration Wi-Fi
const char* ssid = "YOUR_WIFI_SSID";             // Configurez votre SSID local
const char* password = "YOUR_WIFI_PASSWORD";     // Configurez votre mot de passe local

// Configuration MQTT
const char* mqtt_server = "broker.hivemq.com";  // Broker MQTT public
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32-Relay-Controller-001";

// Topics MQTT
const char* topic_status    = "esp32/relay/status";     // Publication du statut
const char* topic_command   = "esp32/relay/command";    // Réception des commandes
const char* topic_schedule  = "esp32/relay/schedule";   // Configuration horaires
const char* topic_heartbeat = "esp32/relay/heartbeat";  // Heartbeat
const char* topic_meter     = "esp32/meter/data";       // Publication des mesures RS485
const char* topic_meter_req = "esp32/meter/request";    // Déclenchement lecture immédiate

// Objets
WebServer server(80);
Preferences preferences;
WiFiClient espClient;
PubSubClient mqtt(espClient);
ModbusMeter meter;

// Variables pour le contrôle des horaires (configurables via MQTT)
int START_HOUR = 22;    // Heure d'activation (défaut: 22h00)
int START_MINUTE = 0;
int END_HOUR = 10;      // Heure de désactivation (défaut: 10h00) 
int END_MINUTE = 0;
bool MANUAL_MODE = false;  // Mode manuel via MQTT
bool MANUAL_STATE = false; // État manuel des relais

// États individuels de chaque canal (0=OFF, 1=AUTO, 2=ON)
int channelStates[6] = {1, 0, 1, 0, 2, 0}; // CH1&CH3 en AUTO, CH5 toujours ON, CH2,CH4,CH6 OFF
bool channelActive[6] = {false};            // État physique actuel de chaque relais (true = fermé)
const char* stateNames[3] = {"OFF", "AUTO", "ON"};
const char* channelNames[6] = {"Lampe 1", "Relais 2", "Lampe 2", "Relais 4", "Climat", "Relais 6"};
const int relayPins[6] = {RELAY_CH1, RELAY_CH2, RELAY_CH3, RELAY_CH4, RELAY_CH5, RELAY_CH6};

// Variables d'état
bool relaysActive = false;
bool wifiConnected = false;
bool mqttConnected = false;
unsigned long lastMqttReconnect  = 0;
unsigned long lastStatusPublish  = 0;
unsigned long lastHeartbeat      = 0;
unsigned long lastMeterRead      = 0;   // Dernière lecture compteur RS485
bool          meterReadPending   = false; // Lecture immédiate demandée via MQTT

// Déclarations des fonctions (prototypes)
void setupRelays();
void setupPreferences();
void updateRelayStates();
void setupWiFi();
void setupWebServer();
void setupMQTT();
void reconnectMQTT();
void publishStatus();
void publishHeartbeat();
void onMqttMessage(char* topic, byte* payload, unsigned int length);
void printSystemStatus();
void printRelayStatus();
void handleRoot();
void handleStatus();
void handleToggle();
void handleConfig();
void handleSetChannel();
void handleRelay();
void handleReset();
void handleOptions();
void handleMeter();
bool isInActiveTimeRange(int currentHour, int currentMinute);
void setupRS485();
void publishMeterData();

void setup() {
  // Configuration spéciale pour ESP32-S3 USB CDC
  #if ARDUINO_USB_CDC_ON_BOOT
  Serial.begin();
  #else
  Serial.begin(115200);
  #endif
  
  // Attendre que la connexion série soit établie
  delay(2000);
  
  Serial.println("=== ESP32-S3 RELAY CONTROLLER + MQTT ===");
  Serial.println("Démarrage du système...");
  
  // Configuration des relais
  Serial.println("Configuration des relais...");
  setupRelays();
  Serial.println("✓ Relais configurés");
  
  // Configuration I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Serial.printf("✓ I2C configuré (SDA:%d, SCL:%d)\n", SDA_PIN, SCL_PIN);

  // Configuration RS485 / Modbus
  Serial.println("Configuration RS485/Modbus...");
  setupRS485();
  Serial.println("✓ RS485 configuré");
  
  // Chargement des préférences
  Serial.println("Chargement des préférences...");
  setupPreferences();
  
  // Appliquer la configuration initiale des relais
  updateRelayStates();
  
  // Configuration Wi-Fi
  Serial.println("Configuration Wi-Fi...");
  setupWiFi();
  
  // Configuration MQTT
  if (wifiConnected) {
    Serial.println("Configuration MQTT...");
    setupMQTT();
  }
  
  // Résumé
  Serial.println("\n=== CONFIGURATION TERMINÉE ===");
  Serial.printf("%s Wi-Fi: %s\n", wifiConnected ? "✓" : "✗", wifiConnected ? "Connecté" : "Erreur");
  Serial.printf("%s MQTT: %s\n", mqttConnected ? "✓" : "✗", mqttConnected ? "Connecté" : "Déconnecté");
  Serial.printf("⏰ Horaires AUTO: %02d:%02d à %02d:%02d\n", START_HOUR, START_MINUTE, END_HOUR, END_MINUTE);
  
  if (wifiConnected) {
    Serial.print("🌐 Interface web: http://");
    Serial.println(WiFi.localIP());
    setupWebServer();
  }

  // Première lecture du compteur au démarrage
  Serial.println("Lecture initiale du compteur RS485...");
  if (meter.readAllData()) {
    Serial.println("✓ Compteur RDZD5 répondant");
  } else {
    Serial.println("⚠ Compteur RDZD5 non répondant (vérifiez le câblage RS485)");
  }
  
  Serial.println("Système prêt !\n");
}

void loop() {
  // Gérer les requêtes web si disponible
  if (wifiConnected) {
    server.handleClient();
  }
  
  // Gérer MQTT
  if (wifiConnected) {
    if (!mqtt.connected()) {
      // Tentative de reconnexion MQTT toutes les 5 secondes
      if (millis() - lastMqttReconnect > 5000) {
        lastMqttReconnect = millis();
        reconnectMQTT();
      }
    } else {
      mqtt.loop();
      
      // Publier le statut toutes les 15 secondes
      if (millis() - lastStatusPublish > 15000) {
        lastStatusPublish = millis();
        publishStatus();
      }
      
      // Publier heartbeat toutes les 30 secondes
      if (millis() - lastHeartbeat > 30000) {
        lastHeartbeat = millis();
        publishHeartbeat();
      }
    }
  }
  
  // Affichage périodique de l'état (toutes les 30 secondes)
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 30000) {
    lastStatus = millis();
    printSystemStatus();
  }
  
  // Contrôle des relais basé sur l'heure NTP
  static unsigned long lastTimeCheck = 0;
  if (millis() - lastTimeCheck > 60000) { // Vérifier chaque minute
    lastTimeCheck = millis();
    
    // Utiliser l'horloge NTP
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      int currentHour = timeinfo.tm_hour;
      int currentMinute = timeinfo.tm_min;
      
      Serial.printf("✓ Heure NTP: %02d:%02d:%02d\n", 
                    timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
      
      // Mettre à jour l'état des relais selon la configuration individuelle
      updateRelayStates();
      
      Serial.println("États des canaux mis à jour");
      
      // Publier le statut après mise à jour
      if (mqttConnected) {
        publishStatus();
      }
    } else {
      Serial.println("⚠ NTP non synchronisé - tentative de resynchronisation...");
      
      // Tentative de resynchronisation si WiFi est connecté
      if (wifiConnected) {
        configTime(2 * 3600, 0, "pool.ntp.org", "time.nist.gov");
      }
    }
  }

  // --- Lecture périodique du compteur RS485 (toutes les 30 secondes) ---
  bool doMeterRead = meterReadPending
                  || (millis() - lastMeterRead > 30000);
  if (doMeterRead) {
    meterReadPending = false;
    lastMeterRead    = millis();
    Serial.println("Lecture compteur RS485...");
    if (meter.readAllData()) {
      const MeterData& d = meter.getData();
      Serial.printf("  V1=%.1fV V2=%.1fV V3=%.1fV | "
                    "I1=%.2fA I2=%.2fA I3=%.2fA | "
                    "Ptot=%.1fW | F=%.2fHz | Imp=%.3fkWh\n",
                    d.v1, d.v2, d.v3,
                    d.i1, d.i2, d.i3,
                    d.pTotal, d.frequency, d.kwhImport);
      if (mqttConnected) publishMeterData();
    } else {
      Serial.printf("⚠ Lecture compteur echouee (erreurs cumulees: %lu)\n",
                    meter.getErrorCount());
    }
  }

  delay(100); // Petit délai pour éviter la surcharge CPU
}

// =============================================================================
// setupRS485() – Initialisation du module Modbus
// =============================================================================
void setupRS485() {
  // Serial1 = UART1 (pins officiels Waveshare : TX=17, RX=18)
  // DE=-1 : transceiver à direction automatique, pas de pin DE/RE
  meter.begin(Serial1,
              RS485_TX_PIN,
              RS485_RX_PIN,
              -1,
              MODBUS_BAUD,
              MODBUS_SLAVE_ADDR);
  Serial.printf("  RS485 : TX=%d RX=%d (auto-direction) @ %d baud, esclave=%d\n",
                RS485_TX_PIN, RS485_RX_PIN,
                MODBUS_BAUD, MODBUS_SLAVE_ADDR);
}

// =============================================================================
// publishMeterData() – Publication MQTT des mesures du compteur
// =============================================================================
void publishMeterData() {
  if (!mqttConnected) return;
  const MeterData& d = meter.getData();
  if (!d.valid) return;

  DynamicJsonDocument doc(1024);
  doc["connected"] = meter.isConnected();
  doc["timestamp"] = d.timestamp;

  // Tensions de phase (L-N)
  JsonObject v = doc.createNestedObject("voltages_LN");
  v["v1"] = serialized(String(d.v1, 1));
  v["v2"] = serialized(String(d.v2, 1));
  v["v3"] = serialized(String(d.v3, 1));

  // Tensions ligne à ligne
  JsonObject vll = doc.createNestedObject("voltages_LL");
  vll["v12"] = serialized(String(d.v12, 1));
  vll["v23"] = serialized(String(d.v23, 1));
  vll["v31"] = serialized(String(d.v31, 1));

  // Courants
  JsonObject cur = doc.createNestedObject("currents");
  cur["i1"] = serialized(String(d.i1, 3));
  cur["i2"] = serialized(String(d.i2, 3));
  cur["i3"] = serialized(String(d.i3, 3));

  // Puissances par phase
  JsonObject pw = doc.createNestedObject("powers");
  pw["p1_W"]  = serialized(String(d.p1,  1));
  pw["p2_W"]  = serialized(String(d.p2,  1));
  pw["p3_W"]  = serialized(String(d.p3,  1));
  pw["pTotal_W"]  = serialized(String(d.pTotal,  1));
  pw["vaTotal_VA"] = serialized(String(d.vaTotal, 1));
  pw["varTotal_VAr"] = serialized(String(d.varTotal, 1));

  // Facteurs de puissance
  JsonObject pf = doc.createNestedObject("power_factors");
  pf["pf1"]   = serialized(String(d.pf1,  3));
  pf["pf2"]   = serialized(String(d.pf2,  3));
  pf["pf3"]   = serialized(String(d.pf3,  3));
  pf["pfTotal"] = serialized(String(d.pfTotal, 3));

  // Fréquence et énergie
  doc["frequency_Hz"]  = serialized(String(d.frequency, 2));
  doc["energy_import_kWh"]   = serialized(String(d.kwhImport,   3));
  doc["energy_export_kWh"]   = serialized(String(d.kwhExport,   3));
  doc["energy_import_kVArh"] = serialized(String(d.kVArhImport, 3));
  doc["energy_export_kVArh"] = serialized(String(d.kVArhExport, 3));

  String payload;
  serializeJson(doc, payload);

  if (mqtt.publish(topic_meter, payload.c_str())) {
    Serial.println("📡 Mesures compteur publiées via MQTT");
  } else {
    Serial.println("❌ Échec publication mesures compteur");
  }
}

void setupMQTT() {
  mqtt.setServer(mqtt_server, mqtt_port);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(1024); // Augmenter le buffer pour JSON
  
  Serial.printf("🔧 MQTT Server: %s:%d\n", mqtt_server, mqtt_port);
  Serial.printf("🔧 Client ID: %s\n", mqtt_client_id);
  
  // Première tentative de connexion
  reconnectMQTT();
}

void reconnectMQTT() {
  if (!mqtt.connected()) {
    Serial.print("Connexion MQTT...");
    
    // Créer un testament (last will) pour indiquer la déconnexion
    String willMessage = "{\"status\":\"offline\",\"timestamp\":" + String(millis()) + "}";
    
    if (mqtt.connect(mqtt_client_id, topic_heartbeat, 0, true, willMessage.c_str())) {
      Serial.println(" ✓ Connecté");
      mqttConnected = true;
      
      // S'abonner aux topics de commandes
      mqtt.subscribe(topic_command);
      mqtt.subscribe(topic_schedule);
      mqtt.subscribe(topic_meter_req);
      
      Serial.printf("📡 Abonné à: %s\n", topic_command);
      Serial.printf("📡 Abonné à: %s\n", topic_schedule);
      Serial.printf("📡 Abonné à: %s\n", topic_meter_req);
      
      // Publier le statut initial
      publishStatus();
      publishHeartbeat();
      
    } else {
      Serial.printf(" ✗ Échec (code: %d)\n", mqtt.state());
      mqttConnected = false;
    }
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Convertir le payload en string
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.printf("📨 MQTT [%s]: %s\n", topic, message.c_str());
  
  // Parser le JSON
  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.printf("❌ Erreur JSON: %s\n", error.c_str());
    return;
  }
  
  // Traitement des commandes
  if (strcmp(topic, topic_command) == 0) {
    if (doc.containsKey("channel") && doc.containsKey("state")) {
      int channel = doc["channel"];
      int state = doc["state"];
      
      if (channel >= 0 && channel < 6 && state >= 0 && state <= 2) {
        channelStates[channel] = state;
        Serial.printf("🔧 Canal CH%d -> %s\n", channel + 1, stateNames[state]);
        
        // Sauvegarder et appliquer
        preferences.putBytes("channelStates", channelStates, sizeof(channelStates));
        updateRelayStates();
        
        // Publier le nouveau statut
        publishStatus();
      }
    }
    
    if (doc.containsKey("manual_mode")) {
      MANUAL_MODE = doc["manual_mode"];
      Serial.printf("🔧 Mode manuel: %s\n", MANUAL_MODE ? "ON" : "OFF");
      preferences.putBool("manualMode", MANUAL_MODE);
      updateRelayStates();
      publishStatus();
    }
  }
  
  // Déclenchement d'une lecture immédiate du compteur
  if (strcmp(topic, topic_meter_req) == 0) {
    Serial.println("📨 Lecture compteur demandée via MQTT");
    meterReadPending = true;
    return;
  }

  // Traitement de la configuration horaires
  if (strcmp(topic, topic_schedule) == 0) {
    if (doc.containsKey("start_hour")) START_HOUR = doc["start_hour"];
    if (doc.containsKey("start_minute")) START_MINUTE = doc["start_minute"];
    if (doc.containsKey("end_hour")) END_HOUR = doc["end_hour"];
    if (doc.containsKey("end_minute")) END_MINUTE = doc["end_minute"];
    
    Serial.printf("🕐 Nouveaux horaires: %02d:%02d - %02d:%02d\n", 
                  START_HOUR, START_MINUTE, END_HOUR, END_MINUTE);
    
    // Sauvegarder
    preferences.putInt("startHour", START_HOUR);
    preferences.putInt("startMinute", START_MINUTE);
    preferences.putInt("endHour", END_HOUR);
    preferences.putInt("endMinute", END_MINUTE);
    
    updateRelayStates();
    publishStatus();
  }
}

void publishStatus() {
  if (!mqttConnected) return;
  
  // Créer le JSON de statut
  DynamicJsonDocument doc(1024);
  
  // État global
  doc["relaysActive"] = relaysActive;
  doc["manualMode"] = MANUAL_MODE;
  doc["wifiConnected"] = wifiConnected;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;
  doc["timestamp"] = millis();
  
  // Horaires
  doc["startHour"] = START_HOUR;
  doc["startMinute"] = START_MINUTE;
  doc["endHour"] = END_HOUR;
  doc["endMinute"] = END_MINUTE;
  
  // Heure actuelle
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    char timeStr[6];
    snprintf(timeStr, sizeof(timeStr), "%d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
    doc["currentTime"] = timeStr;
    
    char dateStr[11];
    snprintf(dateStr, sizeof(dateStr), "%d/%d/%d", 
             timeinfo.tm_mday, timeinfo.tm_mon + 1, timeinfo.tm_year + 1900);
    doc["currentDate"] = dateStr;
    
    doc["ntpSynced"] = true;
  } else {
    doc["currentTime"] = "N/A";
    doc["currentDate"] = "N/A";
    doc["ntpSynced"] = false;
  }
  
  // États des canaux
  JsonArray channels = doc.createNestedArray("channels");
  for (int i = 0; i < 6; i++) {
    JsonObject channel = channels.createNestedObject();
    channel["id"] = i;
    channel["state"] = channelStates[i];
    channel["active"] = channelActive[i];  // état mémoire, fiable sur tous les GPIO
  }
  
  // Sérialiser et publier
  String payload;
  serializeJson(doc, payload);
  
  if (mqtt.publish(topic_status, payload.c_str())) {
    Serial.println("📡 Statut MQTT publié");
  } else {
    Serial.println("❌ Échec publication statut MQTT");
  }
}

void publishHeartbeat() {
  if (!mqttConnected) return;
  
  DynamicJsonDocument doc(256);
  doc["status"] = "online";
  doc["uptime"] = millis() / 1000;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  mqtt.publish(topic_heartbeat, payload.c_str(), true); // Retained message
}

void setupRelays() {
  // Configuration des pins des relais en sortie
  pinMode(RELAY_CH1, OUTPUT);
  pinMode(RELAY_CH2, OUTPUT);
  pinMode(RELAY_CH3, OUTPUT);
  pinMode(RELAY_CH4, OUTPUT);
  pinMode(RELAY_CH5, OUTPUT);
  pinMode(RELAY_CH6, OUTPUT);
  
  // Initialisation des relais (éteints par défaut)
  // Waveshare ESP32-S3-Relay-6CH : logique active-HIGH (HIGH = relais ON, LOW = relais OFF)
  digitalWrite(RELAY_CH1, LOW);
  digitalWrite(RELAY_CH2, LOW);
  digitalWrite(RELAY_CH3, LOW);
  digitalWrite(RELAY_CH4, LOW);
  digitalWrite(RELAY_CH5, LOW);
  digitalWrite(RELAY_CH6, LOW);
}

void setupPreferences() {
  preferences.begin("relay_config", false);
  
  // Charger les paramètres sauvegardés ou utiliser les valeurs par défaut
  START_HOUR = preferences.getInt("startHour", 22);
  START_MINUTE = preferences.getInt("startMinute", 0);
  END_HOUR = preferences.getInt("endHour", 10);
  END_MINUTE = preferences.getInt("endMinute", 0);
  MANUAL_MODE = preferences.getBool("manualMode", false);
  MANUAL_STATE = preferences.getBool("manualState", false);
  
  // Charger les états des canaux individuels
  size_t bytesRead = preferences.getBytes("channelStates", channelStates, sizeof(channelStates));
  if (bytesRead == 0) {
    // Première fois, utiliser les valeurs par défaut et les sauvegarder
    Serial.println("Initialisation des états par défaut:");
    Serial.println("  CH1: AUTO, CH2: OFF, CH3: AUTO, CH4: OFF, CH5: ON, CH6: OFF");
    preferences.putBytes("channelStates", channelStates, sizeof(channelStates));
  }
  
  Serial.println("✓ Préférences chargées");
  Serial.println("  États des canaux:");
  for (int i = 0; i < 6; i++) {
    Serial.printf("    CH%d: %s\n", i + 1, stateNames[channelStates[i]]);
  }
}

void setupWiFi() {
  Serial.printf("  - Connexion au Wi-Fi '%s'...\n", ssid);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n  ✓ Wi-Fi connecté !");
    Serial.print("    Adresse IP: ");
    Serial.println(WiFi.localIP());
    wifiConnected = true;
    
    // Configuration NTP pour la synchronisation de l'heure
    Serial.println("  - Configuration NTP...");
    configTime(2 * 3600, 0, "pool.ntp.org", "time.nist.gov"); // GMT+2 (Europe/Paris)
    
    // Attendre la synchronisation NTP
    Serial.print("  - Synchronisation NTP en cours");
    int ntpAttempts = 0;
    while (!time(nullptr) && ntpAttempts < 30) {
      delay(1000);
      Serial.print(".");
      ntpAttempts++;
    }
    
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      Serial.println("\n  ✓ NTP synchronisé !");
      Serial.printf("    Heure actuelle: %02d:%02d:%02d\n", 
                    timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    } else {
      Serial.println("\n  ⚠ NTP non synchronisé (continuera en arrière-plan)");
    }
  } else {
    Serial.println("\n  ✗ Échec de connexion Wi-Fi");
    Serial.println("    Vérifiez le SSID et le mot de passe");
    wifiConnected = false;
  }
}

void updateRelayStates() {
  struct tm timeinfo;
  bool timeValid = getLocalTime(&timeinfo);
  bool inActiveTimeRange = false;
  
  if (timeValid) {
    inActiveTimeRange = isInActiveTimeRange(timeinfo.tm_hour, timeinfo.tm_min);
  }
  
  // Déterminer si les relais doivent être actifs globalement
  if (MANUAL_MODE) {
    relaysActive = MANUAL_STATE;
  } else {
    relaysActive = timeValid ? inActiveTimeRange : false;
  }
  
  // Appliquer l'état à chaque canal selon sa configuration
  for (int i = 0; i < 6; i++) {
    bool channelOn = false;
    
    switch (channelStates[i]) {
      case 0: // OFF
        channelOn = false;
        break;
      case 1: // AUTO
        channelOn = relaysActive;
        break;
      case 2: // ON
        channelOn = true;
        break;
    }
    
    // Appliquer l'état (HIGH = actif sur la carte Waveshare ESP32-S3-Relay-6CH)
    channelActive[i] = channelOn;
    digitalWrite(relayPins[i], channelOn ? HIGH : LOW);
  }
}

bool isInActiveTimeRange(int currentHour, int currentMinute) {
  // Convertir l'heure actuelle en minutes depuis minuit
  int currentTotalMinutes = currentHour * 60 + currentMinute;
  
  // Convertir les heures de début et fin en minutes
  int startTotalMinutes = START_HOUR * 60 + START_MINUTE;
  int endTotalMinutes = END_HOUR * 60 + END_MINUTE;
  
  // Cas spécial: période qui traverse minuit (22:00 à 10:00)
  if (startTotalMinutes > endTotalMinutes) {
    // La période active va de 22:00 à minuit OU de minuit à 10:00
    return (currentTotalMinutes >= startTotalMinutes || currentTotalMinutes < endTotalMinutes);
  } else {
    // Période normale dans la même journée
    return (currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes);
  }
}

void printSystemStatus() {
  Serial.println("\n=== ÉTAT DU SYSTÈME ===");
  Serial.printf("Temps de fonctionnement: %lu ms\n", millis());
  Serial.printf("Mémoire libre: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("MQTT: %s\n", mqttConnected ? "Connecté" : "Déconnecté");
  
  // Afficher l'heure locale si disponible
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    Serial.printf("Heure locale: %02d/%02d/%04d %02d:%02d:%02d\n",
                  timeinfo.tm_mday, timeinfo.tm_mon + 1, timeinfo.tm_year + 1900,
                  timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  } else {
    Serial.println("Heure: En attente de synchronisation NTP");
  }
  
  if (wifiConnected) {
    Serial.printf("Wi-Fi: Connecté (IP: %s)\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("Wi-Fi: Déconnecté");
  }
  
  printRelayStatus();
  Serial.println("=====================\n");
}

void printRelayStatus() {
  Serial.println("État des relais:");
  for (int i = 0; i < 6; i++) {
    bool isActive = channelActive[i];
    Serial.printf("  CH%d: %s (%s)\n", 
                  i + 1, 
                  isActive ? "ACTIF" : "INACTIF",
                  stateNames[channelStates[i]]);
  }
}

// Fonctions Web Server (maintenues pour compatibilité locale)
void setupWebServer() {
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/toggle", handleToggle);
  server.on("/config", handleConfig);
  server.on("/setChannel", handleSetChannel);
  server.on("/relay", handleRelay);
  server.on("/reset", handleReset);
  server.on("/meter", handleMeter);
  server.onNotFound([](){
    server.send(404, "text/plain", "Page non trouvée");
  });
  
  // Gérer les requêtes OPTIONS pour CORS
  server.on("/status",     HTTP_OPTIONS, handleOptions);
  server.on("/setChannel", HTTP_OPTIONS, handleOptions);
  server.on("/config",     HTTP_OPTIONS, handleOptions);
  server.on("/relay",      HTTP_OPTIONS, handleOptions);
  server.on("/reset",      HTTP_OPTIONS, handleOptions);
  server.on("/meter",      HTTP_OPTIONS, handleOptions);
  
  server.begin();
  Serial.println("✓ Serveur web démarré");
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  server.send(204);
}

void handleRoot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>The Green House</title>";
  html += "<style>";
  html += "* { margin: 0; padding: 0; box-sizing: border-box; }";
  html += "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; color: #333; }";
  html += ".container { max-width: 1200px; margin: 0 auto; padding: 20px; }";
  html += ".header { text-align: center; color: white; margin-bottom: 30px; }";
  html += ".header h1 { font-size: 2.5rem; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }";
  html += ".header p { font-size: 1.2rem; opacity: 0.9; }";
  html += ".card { background: white; border-radius: 15px; padding: 25px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }";
  html += ".status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }";
  html += ".status-item { text-align: center; padding: 15px; border-radius: 10px; color: white; }";
  html += ".status-wifi { background: linear-gradient(45deg, #4CAF50, #45a049); }";
  html += ".status-mqtt { background: linear-gradient(45deg, #2196F3, #1976D2); }";
  html += ".status-time { background: linear-gradient(45deg, #FF9800, #F57C00); }";
  html += ".status-heap { background: linear-gradient(45deg, #9C27B0, #7B1FA2); }";
  html += ".relays-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }";
  html += ".meter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }";
  html += ".meter-val { background: #f8f9fa; border-radius: 10px; padding: 12px 10px; text-align: center; border: 1px solid #e9ecef; }";
  html += ".meter-val .mv { font-size: 1.4rem; font-weight: 700; font-family: monospace; }";
  html += ".meter-val .ml { font-size: 0.78rem; color: #6c757d; margin-top: 4px; }";
  html += ".meter-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }";
  html += ".meter-table th { background: #f1f3f5; color: #495057; padding: 7px 10px; text-align: right; }";
  html += ".meter-table th:first-child { text-align: left; }";
  html += ".meter-table td { padding: 7px 10px; border-top: 1px solid #f1f3f5; text-align: right; font-family: monospace; }";
  html += ".meter-table td:first-child { text-align: left; font-weight: 600; color: #1d4ed8; }";
  html += ".meter-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; }";
  html += ".badge-ok { background: #d1fae5; color: #065f46; }";
  html += ".badge-err { background: #fee2e2; color: #991b1b; }";
  html += ".pf-good { color: #16a34a; } .pf-warn { color: #d97706; } .pf-bad { color: #dc2626; }";
  html += ".energy-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f3f5; font-size: 0.88rem; }";
  html += ".energy-row:last-child { border-bottom: none; }";
  html += ".relays-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; }";
  html += ".relay-card { background: #f8f9fa; border-radius: 10px; padding: 20px; text-align: center; transition: all 0.3s ease; border: 2px solid #e9ecef; }";
  html += ".relay-card.active { background: linear-gradient(45deg, #28a745, #20c997); color: white; border-color: #28a745; transform: translateY(-2px); }";
  html += ".relay-number { font-size: 1.5rem; font-weight: bold; margin-bottom: 10px; }";
  html += ".relay-state { font-size: 0.9rem; margin-bottom: 15px; }";
  html += ".btn { padding: 10px 20px; border: none; border-radius: 25px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease; }";
  html += ".btn-primary { background: linear-gradient(45deg, #007bff, #0056b3); color: white; }";
  html += ".btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,123,255,0.4); }";
  html += ".btn-success { background: linear-gradient(45deg, #28a745, #20c997); color: white; }";
  html += ".btn-danger { background: linear-gradient(45deg, #dc3545, #c82333); color: white; }";
  html += ".btn-mode { background: white; color: #666; border: 1px solid #ddd; }";
  html += ".btn-mode.active-mode { background: #e9ecef; color: #333; border-color: #666; }";
  html += ".btn-small { padding: 5px 10px; font-size: 0.8rem; margin: 2px; }";
  html += ".btn-small { padding: 5px 10px; font-size: 0.8rem; margin: 2px; }";
  html += ".mode-buttons { display: flex; flex-wrap: nowrap; justify-content: center; gap: 5px; white-space: nowrap; }";
  html += ".btn.active-mode { box-shadow: 0 0 5px rgba(0,0,0,0.3); }";
  html += ".schedule-info { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 20px; }";
  html += ".legend-hint { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 8px 14px; border-radius: 6px; margin-bottom: 15px; font-size: 0.9rem; color: #374151; }";
  html += ".footer { text-align: center; color: white; margin-top: 30px; opacity: 0.8; }";
  html += "@media (max-width: 768px) { .header h1 { font-size: 2rem; } .status-grid { grid-template-columns: 1fr; } }";
  html += "</style></head><body>";
  html += "<div class='container'>";
  html += "<div class='header'>";
  html += "<h1>🌱 The Green House</h1>";
  html += "<p>Contrôle à distance des équipements</p>";
  html += "</div>";
  html += "<div class='card'>";
  html += "<h2>📊 Statut Système</h2>";
  html += "<div class='status-grid' id='statusGrid'>";
  html += "<div class='status-item status-wifi'><h3>📡 WiFi</h3><p id='wifiStatus'>Chargement...</p></div>";
  html += "<div class='status-item status-mqtt'><h3>☁️ MQTT</h3><p id='mqttStatus'>Chargement...</p></div>";
  html += "<div class='status-item status-time'><h3>⏰ Heure</h3><p id='timeStatus'>Chargement...</p></div>";
  html += "<div class='status-item status-heap'><h3>💾 Mémoire</h3><p id='heapStatus'>Chargement...</p></div>";
  html += "</div>";
  html += "</div>";
  html += "<div class='card'>";
  html += "<h2>🔧 Contrôle des Relais</h2>";
  html += "<p class='legend-hint'>💡 <strong style='color:#22c55e;'>Vert</strong> = état actif (relais fermé)</p>";
  html += "<div class='relays-grid' id='relaysGrid'>";
  html += "</div>";
  html += "<div class='schedule-info'>";
  html += "<h3>📅 Programmation Horaire</h3>";
  html += "<p id='scheduleInfo'>Chargement...</p>";
  html += "</div>";
  html += "</div>";
  html += "<div class='card'>";
  html += "<h2>🛠️ Actions Rapides</h2>";
  html += "<button class='btn btn-primary' onclick='refreshStatus()'>🔄 Actualiser</button> ";
  html += "<button class='btn btn-success' onclick='window.open(\"/status\", \"_blank\")'>📋 JSON Complet</button> ";
  html += "<button class='btn btn-danger' onclick='toggleAllRelays()'>⚡ Basculer Tous</button>";
  html += "</div>";
  // --- Compteur RS485 ---
  html += "<div class='card'>";
  html += "<h2>⚡ Compteur RS485 — RDZD5-MID &nbsp;<span id='meterBadge' class='meter-badge badge-err'>Déconnecté</span></h2>";
  html += "<div id='meterContent'><p style='color:#9ca3af;text-align:center;padding:20px'>Chargement des données RS485...</p></div>";
  html += "</div>";
  html += "<div class='footer'>";
  html += "<p>ESP32-S3 Relay Controller • Firmware MQTT • " + String(ESP.getFreeHeap()) + " bytes libres</p>";
  html += "</div>";
  html += "</div>";
  html += "<script>";
  html += "var statusData = null;";
  html += "function fetchStatus() {";
  html += "  var xhr = new XMLHttpRequest();";
  html += "  xhr.open('GET', '/status', true);";
  html += "  xhr.onreadystatechange = function() {";
  html += "    if (xhr.readyState === 4 && xhr.status === 200) {";
  html += "      statusData = JSON.parse(xhr.responseText);";
  html += "      updateDisplay();";
  html += "    }";
  html += "  };";
  html += "  xhr.send();";
  html += "}";
  html += "function updateDisplay() {";
  html += "  if (!statusData) return;";
  html += "  document.getElementById('wifiStatus').innerHTML = statusData.wifiConnected ? '✅ Connecté' : '❌ Déconnecté';";
  html += "  document.getElementById('mqttStatus').innerHTML = statusData.mqttConnected ? '✅ Connecté' : '❌ Déconnecté';";
  html += "  document.getElementById('timeStatus').innerHTML = statusData.currentTime + '<br>' + statusData.currentDate;";
  html += "  document.getElementById('heapStatus').innerHTML = Math.round(statusData.freeHeap/1024) + ' KB<br>Uptime: ' + Math.round(statusData.uptime/60) + 'min';";
  html += "  var relaysHtml = '';";
  html += "  var channelNames = ['Lampe 1', 'Relais 2', 'Lampe 2', 'Relais 4', 'Climat', 'Relais 6'];";
  html += "  for (var i = 0; i < statusData.channels.length; i++) {";
  html += "    var ch = statusData.channels[i];";
  html += "    var activeClass = ch.active ? ' active' : '';";
  html += "    var stateText = ch.state === 0 ? 'OFF' : ch.state === 1 ? 'AUTO' : 'ON';";
  html += "    relaysHtml += '<div class=\"relay-card' + activeClass + '\">';";
  html += "    relaysHtml += '<div class=\"relay-number\">' + channelNames[ch.id] + '</div>';";
  html += "    relaysHtml += '<div class=\"relay-state\">Mode: ' + stateText + '</div>';";
  html += "    relaysHtml += '<div class=\"mode-buttons\">';";
  html += "    relaysHtml += '<button class=\"btn btn-mode btn-small' + (ch.state === 0 ? ' active-mode' : '') + '\" onclick=\"setRelayMode(' + ch.id + ', 0)\">OFF</button>';";
  html += "    relaysHtml += '<button class=\"btn btn-mode btn-small' + (ch.state === 1 ? ' active-mode' : '') + '\" onclick=\"setRelayMode(' + ch.id + ', 1)\">AUTO</button>';";
  html += "    relaysHtml += '<button class=\"btn btn-mode btn-small' + (ch.state === 2 ? ' active-mode' : '') + '\" onclick=\"setRelayMode(' + ch.id + ', 2)\">ON</button>';";
  html += "    relaysHtml += '</div>';";
  html += "    relaysHtml += '</div>';";
  html += "  }";
  html += "  document.getElementById('relaysGrid').innerHTML = relaysHtml;";
  html += "  var startMin = statusData.startMinute < 10 ? '0' + statusData.startMinute : statusData.startMinute;";
  html += "  var endMin = statusData.endMinute < 10 ? '0' + statusData.endMinute : statusData.endMinute;";
  html += "  document.getElementById('scheduleInfo').innerHTML = 'Activation: ' + statusData.startHour + ':' + startMin + ' - ' + statusData.endHour + ':' + endMin;";
  html += "}";
  html += "function setRelayMode(id, mode) {";
  html += "  var xhr = new XMLHttpRequest();";
  html += "  xhr.open('POST', '/relay?channel=' + id + '&state=' + mode, true);";
  html += "  xhr.onreadystatechange = function() {";
  html += "    if (xhr.readyState === 4) setTimeout(fetchStatus, 100);";
  html += "  };";
  html += "  xhr.send();";
  html += "}";
  html += "function toggleRelay(id) {";
  html += "  var xhr = new XMLHttpRequest();";
  html += "  xhr.open('POST', '/relay?channel=' + id + '&state=toggle', true);";
  html += "  xhr.onreadystatechange = function() {";
  html += "    if (xhr.readyState === 4) setTimeout(fetchStatus, 100);";
  html += "  };";
  html += "  xhr.send();";
  html += "}";
  html += "function toggleAllRelays() {";
  html += "  var xhr = new XMLHttpRequest();";
  html += "  xhr.open('POST', '/relay?action=toggle_all', true);";
  html += "  xhr.onreadystatechange = function() {";
  html += "    if (xhr.readyState === 4) setTimeout(fetchStatus, 100);";
  html += "  };";
  html += "  xhr.send();";
  html += "}";
  html += "function refreshStatus() { fetchStatus(); }";
  html += "fetchStatus();";
  html += "setInterval(fetchStatus, 3000);";
  html += "function pfClass(v){ return Math.abs(v)>=0.95?'pf-good':Math.abs(v)>=0.85?'pf-warn':'pf-bad'; }";
  html += "function fetchMeter() {";
  html += "  var xhr = new XMLHttpRequest();";
  html += "  xhr.open('GET', '/meter', true);";
  html += "  xhr.onreadystatechange = function() {";
  html += "    if (xhr.readyState === 4) {";
  html += "      var badge = document.getElementById('meterBadge');";
  html += "      var content = document.getElementById('meterContent');";
  html += "      if (xhr.status === 200) {";
  html += "        try {";
  html += "          var d = JSON.parse(xhr.responseText);";
  html += "          if (!d.connected || !d.valid) {";
  html += "            badge.className='meter-badge badge-err'; badge.textContent='Déconnecté';";
  html += "            content.innerHTML=\"<p style='color:#9ca3af;text-align:center;padding:20px'>Compteur non répondant — vérifiez le câblage RS485</p>\";";
  html += "            return;";
  html += "          }";
  html += "          badge.className='meter-badge badge-ok'; badge.textContent='Connecté';";
  html += "          var v=d.voltages_LN, vll=d.voltages_LL, i=d.currents, p=d.powers, pf=d.power_factors;";
  html += "          var h='';";
  html += "          h+=\"<table class='meter-table'><thead><tr><th>Phase</th><th>Tension L-N</th><th>Courant</th><th>Puissance</th><th>Facteur P.</th></tr></thead><tbody>\";";
  html += "          var phases = [['L1',+v.v1,+i.i1,+p.p1_W,+pf.pf1],['L2',+v.v2,+i.i2,+p.p2_W,+pf.pf2],['L3',+v.v3,+i.i3,+p.p3_W,+pf.pf3]];";
  html += "          for(var j=0;j<phases.length;j++){";
  html += "            var ph=phases[j];";
  html += "            h+='<tr><td>'+ph[0]+'</td><td>'+ph[1].toFixed(1)+' V</td><td>'+ph[2].toFixed(3)+' A</td><td>'+ph[3].toFixed(1)+' W</td><td class=\"'+pfClass(ph[4])+'\">'+ph[4].toFixed(3)+'</td></tr>';";
  html += "          }";
  html += "          h+='</tbody></table><br>';";
  html += "          h+=\"<div class='meter-grid'>\";";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv\" style=\"color:#ea580c\">'+((+p.pTotal_W).toFixed(1))+'<small style=\"font-size:.7em\"> W</small></div><div class=\"ml\">Puissance totale</div></div>';";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv\" style=\"color:#2563eb\">'+((+p.vaTotal_VA).toFixed(1))+'<small style=\"font-size:.7em\"> VA</small></div><div class=\"ml\">Apparent</div></div>';";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv\" style=\"color:#7c3aed\">'+((+p.varTotal_VAr).toFixed(1))+'<small style=\"font-size:.7em\"> VAr</small></div><div class=\"ml\">Réactif</div></div>';";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv '+pfClass(+pf.pfTotal)+'\">'+((+pf.pfTotal).toFixed(3))+'</div><div class=\"ml\">FP global</div></div>';";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv\" style=\"color:#4f46e5\">'+((+d.frequency_Hz).toFixed(2))+'<small style=\"font-size:.7em\"> Hz</small></div><div class=\"ml\">Fréquence</div></div>';";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv\">'+((+vll.v12).toFixed(1))+'<small style=\"font-size:.7em\"> V</small></div><div class=\"ml\">V L1-L2</div></div>';";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv\">'+((+vll.v23).toFixed(1))+'<small style=\"font-size:.7em\"> V</small></div><div class=\"ml\">V L2-L3</div></div>';";
  html += "          h+='<div class=\"meter-val\"><div class=\"mv\">'+((+vll.v31).toFixed(1))+'<small style=\"font-size:.7em\"> V</small></div><div class=\"ml\">V L3-L1</div></div>';";
  html += "          h+='</div>';";
  html += "          h+=\"<div style='margin-top:8px'>\";";
  html += "          h+='<div class=\"energy-row\"><span>Import actif</span><strong style=\"color:#16a34a\">'+((+d.energy_import_kWh).toFixed(3))+' kWh</strong></div>';";
  html += "          h+='<div class=\"energy-row\"><span>Export actif</span><strong>'+((+d.energy_export_kWh).toFixed(3))+' kWh</strong></div>';";
  html += "          h+='<div class=\"energy-row\"><span>Import réactif</span><strong style=\"color:#16a34a\">'+((+d.energy_import_kVArh).toFixed(3))+' kVArh</strong></div>';";
  html += "          h+='<div class=\"energy-row\"><span>Export réactif</span><strong>'+((+d.energy_export_kVArh).toFixed(3))+' kVArh</strong></div>';";
  html += "          h+='</div>';";
  html += "          content.innerHTML = h;";
  html += "        } catch(e) { console.error('fetchMeter error:', e); }";
  html += "      } else {";
  html += "        console.error('fetchMeter HTTP error:', xhr.status);";
  html += "      }";
  html += "    }";
  html += "  };";
  html += "  xhr.send();";
  html += "}";
  html += "</script></body></html>";
  server.send(200, "text/html; charset=UTF-8", html);
}

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  server.sendHeader("Content-Type", "application/json; charset=utf-8");
  
  // Réutiliser la même logique que MQTT
  DynamicJsonDocument doc(1024);
  
  doc["relaysActive"] = relaysActive;
  doc["manualMode"] = MANUAL_MODE;
  doc["wifiConnected"] = wifiConnected;
  doc["mqttConnected"] = mqttConnected;
  doc["freeHeap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;
  
  doc["startHour"] = START_HOUR;
  doc["startMinute"] = START_MINUTE;
  doc["endHour"] = END_HOUR;
  doc["endMinute"] = END_MINUTE;
  
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    char timeStr[6];
    snprintf(timeStr, sizeof(timeStr), "%d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
    doc["currentTime"] = timeStr;
    
    char dateStr[11];
    snprintf(dateStr, sizeof(dateStr), "%d/%d/%d", 
             timeinfo.tm_mday, timeinfo.tm_mon + 1, timeinfo.tm_year + 1900);
    doc["currentDate"] = dateStr;
    
    doc["ntpSynced"] = true;
  } else {
    doc["currentTime"] = "N/A";
    doc["currentDate"] = "N/A";
    doc["ntpSynced"] = false;
  }
  
  JsonArray channels = doc.createNestedArray("channels");
  for (int i = 0; i < 6; i++) {
    JsonObject channel = channels.createNestedObject();
    channel["id"] = i;
    channel["state"] = channelStates[i];
    channel["active"] = channelActive[i];  // état mémoire, fiable sur tous les GPIO
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json; charset=utf-8", response);
}

void handleToggle() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  MANUAL_MODE = !MANUAL_MODE;
  MANUAL_STATE = !MANUAL_STATE;
  
  preferences.putBool("manualMode", MANUAL_MODE);
  preferences.putBool("manualState", MANUAL_STATE);
  
  updateRelayStates();
  
  if (mqttConnected) {
    publishStatus();
  }
  
  server.send(200, "text/plain", MANUAL_MODE ? "Mode manuel activé" : "Mode automatique activé");
}

void handleConfig() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  if (server.method() == HTTP_POST) {
    if (server.hasArg("start_time")) {
      String startTime = server.arg("start_time");
      int colonIndex = startTime.indexOf(':');
      if (colonIndex > 0) {
        START_HOUR = startTime.substring(0, colonIndex).toInt();
        START_MINUTE = startTime.substring(colonIndex + 1).toInt();
      }
    }
    
    if (server.hasArg("end_time")) {
      String endTime = server.arg("end_time");
      int colonIndex = endTime.indexOf(':');
      if (colonIndex > 0) {
        END_HOUR = endTime.substring(0, colonIndex).toInt();
        END_MINUTE = endTime.substring(colonIndex + 1).toInt();
      }
    }
    
    preferences.putInt("startHour", START_HOUR);
    preferences.putInt("startMinute", START_MINUTE);
    preferences.putInt("endHour", END_HOUR);
    preferences.putInt("endMinute", END_MINUTE);
    
    updateRelayStates();
    
    if (mqttConnected) {
      publishStatus();
    }
    
    server.send(200, "text/plain", "Configuration sauvegardée");
  }
}

void handleSetChannel() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  
  if (server.hasArg("channel") && server.hasArg("state")) {
    int channel = server.arg("channel").toInt();
    int state = server.arg("state").toInt();
    
    if (channel >= 0 && channel < 6 && state >= 0 && state <= 2) {
      channelStates[channel] = state;
      preferences.putBytes("channelStates", channelStates, sizeof(channelStates));
      updateRelayStates();
      
      if (mqttConnected) {
        publishStatus();
      }
      
      server.send(200, "text/plain", "Canal configuré");
    } else {
      server.send(400, "text/plain", "Paramètres invalides");
    }
  } else {
    server.send(400, "text/plain", "Paramètres manquants");
  }
}

void handleRelay() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  
  // Gestion de l'action toggle_all
  if (server.hasArg("action") && server.arg("action") == "toggle_all") {
    for (int i = 0; i < 6; i++) {
      // Basculer entre ON (1) et OFF (0), ignorer AUTO (2)
      if (channelStates[i] == 1) {
        channelStates[i] = 0;
      } else {
        channelStates[i] = 1;
      }
    }
    preferences.putBytes("channelStates", channelStates, sizeof(channelStates));
    updateRelayStates();
    
    if (mqttConnected) {
      publishStatus();
    }
    
    server.send(200, "text/plain", "Tous les relais basculés");
    return;
  }
  
  // Gestion des modes spécifiques (0, 1, 2) ou toggle
  if (server.hasArg("channel") && server.hasArg("state")) {
    int channel = server.arg("channel").toInt();
    String stateStr = server.arg("state");
    
    if (channel >= 0 && channel < 6) {
      if (stateStr == "toggle") {
        // Basculer entre ON (1) et OFF (0)
        if (channelStates[channel] == 1) {
          channelStates[channel] = 0;
        } else {
          channelStates[channel] = 1;
        }
      } else {
        // Mode spécifique (0=OFF, 1=ON, 2=AUTO)
        int state = stateStr.toInt();
        if (state >= 0 && state <= 2) {
          channelStates[channel] = state;
        } else {
          server.send(400, "text/plain", "État invalide (0=OFF, 1=ON, 2=AUTO)");
          return;
        }
      }
      
      preferences.putBytes("channelStates", channelStates, sizeof(channelStates));
      updateRelayStates();
      
      if (mqttConnected) {
        publishStatus();
      }
      
      String modeText = channelStates[channel] == 0 ? "OFF" : 
                        channelStates[channel] == 1 ? "ON" : "AUTO";
      server.send(200, "text/plain", "Relais " + String(channel + 1) + " -> " + modeText);
    } else {
      server.send(400, "text/plain", "Canal invalide");
    }
  } else {
    server.send(400, "text/plain", "Paramètres invalides");
  }
}

// =============================================================================
// handleMeter() – Endpoint GET /meter : JSON des mesures du compteur
// =============================================================================
void handleMeter() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  const MeterData& d = meter.getData();
  DynamicJsonDocument doc(1024);

  doc["connected"]   = meter.isConnected();
  doc["errorCount"]  = meter.getErrorCount();
  doc["valid"]       = d.valid;
  doc["timestamp"]   = d.timestamp;

  JsonObject vLN = doc.createNestedObject("voltages_LN");
  vLN["v1"] = serialized(String(d.v1, 1));
  vLN["v2"] = serialized(String(d.v2, 1));
  vLN["v3"] = serialized(String(d.v3, 1));

  JsonObject vLL = doc.createNestedObject("voltages_LL");
  vLL["v12"] = serialized(String(d.v12, 1));
  vLL["v23"] = serialized(String(d.v23, 1));
  vLL["v31"] = serialized(String(d.v31, 1));

  JsonObject cur = doc.createNestedObject("currents");
  cur["i1"] = serialized(String(d.i1, 3));
  cur["i2"] = serialized(String(d.i2, 3));
  cur["i3"] = serialized(String(d.i3, 3));

  JsonObject pw = doc.createNestedObject("powers");
  pw["p1_W"]         = serialized(String(d.p1,      1));
  pw["p2_W"]         = serialized(String(d.p2,      1));
  pw["p3_W"]         = serialized(String(d.p3,      1));
  pw["pTotal_W"]     = serialized(String(d.pTotal,  1));
  pw["vaTotal_VA"]   = serialized(String(d.vaTotal, 1));
  pw["varTotal_VAr"] = serialized(String(d.varTotal,1));

  JsonObject pf = doc.createNestedObject("power_factors");
  pf["pf1"]    = serialized(String(d.pf1,    3));
  pf["pf2"]    = serialized(String(d.pf2,    3));
  pf["pf3"]    = serialized(String(d.pf3,    3));
  pf["pfTotal"]= serialized(String(d.pfTotal,3));

  doc["frequency_Hz"]        = serialized(String(d.frequency,   2));
  doc["energy_import_kWh"]   = serialized(String(d.kwhImport,   3));
  doc["energy_export_kWh"]   = serialized(String(d.kwhExport,   3));
  doc["energy_import_kVArh"] = serialized(String(d.kVArhImport, 3));
  doc["energy_export_kVArh"] = serialized(String(d.kVArhExport, 3));

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json; charset=utf-8", response);
}

void handleReset() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  
  // Reset aux valeurs par défaut : CH1=AUTO, CH2=OFF, CH3=AUTO, CH4=OFF, CH5=ON, CH6=OFF
  channelStates[0] = 2; // CH1 = AUTO
  channelStates[1] = 0; // CH2 = OFF  
  channelStates[2] = 2; // CH3 = AUTO
  channelStates[3] = 0; // CH4 = OFF
  channelStates[4] = 1; // CH5 = ON
  channelStates[5] = 0; // CH6 = OFF
  
  // Sauvegarder les nouveaux états
  preferences.putBytes("channelStates", channelStates, sizeof(channelStates));
  updateRelayStates();
  
  if (mqttConnected) {
    publishStatus();
  }
  
  Serial.println("🔄 Reset aux valeurs par défaut:");
  Serial.println("  CH1: AUTO, CH2: OFF, CH3: AUTO, CH4: OFF, CH5: ON, CH6: OFF");
  
  server.send(200, "text/plain", "Reset effectué - CH1:AUTO, CH2:OFF, CH3:AUTO, CH4:OFF, CH5:ON, CH6:OFF");
}