#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "time.h"

// Configuration des pins pour l'ESP32-S3-Relay-6CH de Waveshare
#define RELAY_CH1 2   // Pin pour le relais CH1
#define RELAY_CH2 3   // Pin pour le relais CH2
#define RELAY_CH3 4   // Pin pour le relais CH3
#define RELAY_CH4 5   // Pin pour le relais CH4
#define RELAY_CH5 6   // Pin pour le relais CH5
#define RELAY_CH6 7   // Pin pour le relais CH6

// Configuration I2C pour extensions futures
#define SDA_PIN 8     // Pin SDA pour I2C
#define SCL_PIN 9     // Pin SCL pour I2C

// Configuration Wi-Fi
const char* ssid = "YOUR_WIFI_SSID";             // Configurez votre SSID local
const char* password = "YOUR_WIFI_PASSWORD";     // Configurez votre mot de passe local

// Configuration MQTT
const char* mqtt_server = "broker.hivemq.com";  // Broker MQTT public
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32-Relay-Controller-001";

// Topics MQTT
const char* topic_status = "esp32/relay/status";        // Publication du statut
const char* topic_command = "esp32/relay/command";      // Réception des commandes
const char* topic_schedule = "esp32/relay/schedule";    // Configuration horaires
const char* topic_heartbeat = "esp32/relay/heartbeat";  // Heartbeat

// Objets
WebServer server(80);
Preferences preferences;
WiFiClient espClient;
PubSubClient mqtt(espClient);

// Variables pour le contrôle des horaires (configurables via MQTT)
int START_HOUR = 22;    // Heure d'activation (défaut: 22h00)
int START_MINUTE = 0;
int END_HOUR = 10;      // Heure de désactivation (défaut: 10h00) 
int END_MINUTE = 0;
bool MANUAL_MODE = false;  // Mode manuel via MQTT
bool MANUAL_STATE = false; // État manuel des relais

// États individuels de chaque canal (0=OFF, 1=AUTO, 2=ON)
int channelStates[6] = {2, 0, 2, 0, 1, 0}; // CH1&CH3 en AUTO, CH5 en ON, CH2,CH4,CH6 en OFF
const char* stateNames[3] = {"OFF", "AUTO", "ON"};
const int relayPins[6] = {RELAY_CH1, RELAY_CH2, RELAY_CH3, RELAY_CH4, RELAY_CH5, RELAY_CH6};

// Variables d'état
bool relaysActive = false;
bool wifiConnected = false;
bool mqttConnected = false;
unsigned long lastMqttReconnect = 0;
unsigned long lastStatusPublish = 0;
unsigned long lastHeartbeat = 0;

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
bool isInActiveTimeRange(int currentHour, int currentMinute);

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
  
  delay(100); // Petit délai pour éviter la surcharge CPU
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
      
      Serial.printf("📡 Abonné à: %s\n", topic_command);
      Serial.printf("📡 Abonné à: %s\n", topic_schedule);
      
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
    channel["active"] = digitalRead(relayPins[i]) == LOW;  // LOW = actif sur module relais
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
  
  // Initialisation des relais (éteints par défaut - HIGH = éteint sur la plupart des modules relais)
  digitalWrite(RELAY_CH1, HIGH);
  digitalWrite(RELAY_CH2, HIGH);
  digitalWrite(RELAY_CH3, HIGH);
  digitalWrite(RELAY_CH4, HIGH);
  digitalWrite(RELAY_CH5, HIGH);
  digitalWrite(RELAY_CH6, HIGH);
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
    bool channelActive = false;
    
    switch (channelStates[i]) {
      case 0: // OFF
        channelActive = false;
        break;
      case 1: // AUTO
        channelActive = relaysActive;
        break;
      case 2: // ON
        channelActive = true;
        break;
    }
    
    // Appliquer l'état (LOW = actif sur la plupart des modules relais)
    digitalWrite(relayPins[i], channelActive ? LOW : HIGH);
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
    bool isActive = (digitalRead(relayPins[i]) == LOW);
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
  server.onNotFound([](){
    server.send(404, "text/plain", "Page non trouvée");
  });
  
  // Gérer les requêtes OPTIONS pour CORS
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/setChannel", HTTP_OPTIONS, handleOptions);
  server.on("/config", HTTP_OPTIONS, handleOptions);
  server.on("/relay", HTTP_OPTIONS, handleOptions);
  server.on("/reset", HTTP_OPTIONS, handleOptions);
  
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
  html += "<title>ESP32 Relay Controller</title>";
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
  html += ".relay-card { background: #f8f9fa; border-radius: 10px; padding: 20px; text-align: center; transition: all 0.3s ease; border: 2px solid #e9ecef; }";
  html += ".relay-card.active { background: linear-gradient(45deg, #28a745, #20c997); color: white; border-color: #28a745; transform: translateY(-2px); }";
  html += ".relay-number { font-size: 1.5rem; font-weight: bold; margin-bottom: 10px; }";
  html += ".relay-state { font-size: 0.9rem; margin-bottom: 15px; }";
  html += ".btn { padding: 10px 20px; border: none; border-radius: 25px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease; }";
  html += ".btn-primary { background: linear-gradient(45deg, #007bff, #0056b3); color: white; }";
  html += ".btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,123,255,0.4); }";
  html += ".btn-success { background: linear-gradient(45deg, #28a745, #20c997); color: white; }";
  html += ".btn-danger { background: linear-gradient(45deg, #dc3545, #c82333); color: white; }";
  html += ".btn-warning { background: linear-gradient(45deg, #ffc107, #e0a800); color: #212529; }";
  html += ".btn-small { padding: 5px 10px; font-size: 0.8rem; margin: 2px; }";
  html += ".mode-buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }";
  html += ".btn.active-mode { box-shadow: 0 0 10px rgba(0,0,0,0.5); transform: scale(1.05); }";
  html += ".schedule-info { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 20px; }";
  html += ".footer { text-align: center; color: white; margin-top: 30px; opacity: 0.8; }";
  html += "@media (max-width: 768px) { .header h1 { font-size: 2rem; } .status-grid { grid-template-columns: 1fr; } }";
  html += "</style></head><body>";
  html += "<div class='container'>";
  html += "<div class='header'>";
  html += "<h1>🔌 ESP32 Relay Controller</h1>";
  html += "<p>Interface Web Moderne avec Support MQTT</p>";
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
  html += "<div class='footer'>";
  html += "<p>ESP32-S3 Relay Controller • Firmware MQTT • " + String(ESP.getFreeHeap()) + " bytes libres</p>";
  html += "</div>";
  html += "</div>";
  html += "<script>";
  html += "let statusData = null;";
  html += "async function fetchStatus() {";
  html += "  try {";
  html += "    const response = await fetch('/status');";
  html += "    statusData = await response.json();";
  html += "    updateDisplay();";
  html += "  } catch(e) { console.error('Erreur:', e); }";
  html += "}";
  html += "function updateDisplay() {";
  html += "  if (!statusData) return;";
  html += "  document.getElementById('wifiStatus').innerHTML = statusData.wifiConnected ? '✅ Connecté' : '❌ Déconnecté';";
  html += "  document.getElementById('mqttStatus').innerHTML = statusData.mqttConnected ? '✅ Connecté' : '❌ Déconnecté';";
  html += "  document.getElementById('timeStatus').innerHTML = statusData.currentTime + '<br>' + statusData.currentDate;";
  html += "  document.getElementById('heapStatus').innerHTML = Math.round(statusData.freeHeap/1024) + ' KB<br>Uptime: ' + Math.round(statusData.uptime/60) + 'min';";
  html += "  let relaysHtml = '';";
  html += "  statusData.channels.forEach(ch => {";
  html += "    const activeClass = ch.active ? ' active' : '';";
  html += "    const stateText = ch.state === 0 ? 'OFF' : ch.state === 1 ? 'ON' : 'AUTO';";
  html += "    relaysHtml += `<div class='relay-card${activeClass}'>`;";
  html += "    relaysHtml += `<div class='relay-number'>Relais ${ch.id + 1}</div>`;";
  html += "    relaysHtml += `<div class='relay-state'>Mode: ${stateText}</div>`;";
  html += "    relaysHtml += `<div class='mode-buttons'>`;";
  html += "    relaysHtml += `<button class='btn btn-danger btn-small${ch.state === 0 ? ' active-mode' : ''}' onclick='setRelayMode(${ch.id}, 0)'>OFF</button>`;";
  html += "    relaysHtml += `<button class='btn btn-success btn-small${ch.state === 1 ? ' active-mode' : ''}' onclick='setRelayMode(${ch.id}, 1)'>ON</button>`;";
  html += "    relaysHtml += `<button class='btn btn-warning btn-small${ch.state === 2 ? ' active-mode' : ''}' onclick='setRelayMode(${ch.id}, 2)'>AUTO</button>`;";
  html += "    relaysHtml += `</div>`;";
  html += "    relaysHtml += `</div>`;";
  html += "  });";
  html += "  document.getElementById('relaysGrid').innerHTML = relaysHtml;";
  html += "  document.getElementById('scheduleInfo').innerHTML = `Activation: ${statusData.startHour}:${statusData.startMinute.toString().padStart(2,'0')} - ${statusData.endHour}:${statusData.endMinute.toString().padStart(2,'0')}`;";
  html += "}";
  html += "function setRelayMode(id, mode) {";
  html += "  fetch(`/relay?channel=${id}&state=${mode}`, {method: 'POST'})";
  html += "    .then(() => setTimeout(fetchStatus, 100));";
  html += "}";
  html += "function toggleRelay(id) {";
  html += "  fetch(`/relay?channel=${id}&state=toggle`, {method: 'POST'})";
  html += "    .then(() => setTimeout(fetchStatus, 100));";
  html += "}";
  html += "function toggleAllRelays() {";
  html += "  fetch('/relay?action=toggle_all', {method: 'POST'})";
  html += "    .then(() => setTimeout(fetchStatus, 100));";
  html += "}";
  html += "function refreshStatus() { fetchStatus(); }";
  html += "fetchStatus();";
  html += "setInterval(fetchStatus, 3000);";
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
    channel["active"] = digitalRead(relayPins[i]) == LOW;
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