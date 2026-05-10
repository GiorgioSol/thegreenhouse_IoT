#!/usr/bin/env python3
"""
Script de test MQTT pour ESP32-S3 Relay Controller
"""

import paho.mqtt.client as mqtt
import json
import time
import threading

# Configuration MQTT (même que l'ESP32)
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_CLIENT_ID = "ESP32-Test-Client"

# Topics
TOPIC_COMMAND = "esp32/relay/command"
TOPIC_STATUS = "esp32/relay/status"
TOPIC_SCHEDULE = "esp32/relay/schedule"
TOPIC_HEARTBEAT = "esp32/relay/heartbeat"

class MqttTester:
    def __init__(self):
        self.client = mqtt.Client(client_id=MQTT_CLIENT_ID)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.connected = False
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"✅ Connecté au broker MQTT {MQTT_BROKER}")
            self.connected = True
            # S'abonner aux topics de réponse
            client.subscribe(TOPIC_STATUS)
            client.subscribe(TOPIC_HEARTBEAT)
            print(f"📡 Abonné aux topics: {TOPIC_STATUS}, {TOPIC_HEARTBEAT}")
        else:
            print(f"❌ Échec de connexion MQTT, code: {rc}")

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode()
        timestamp = time.strftime("%H:%M:%S")
        
        print(f"\n[{timestamp}] 📨 Reçu sur {topic}:")
        try:
            # Essayer de parser le JSON
            data = json.loads(payload)
            print(json.dumps(data, indent=2, ensure_ascii=False))
        except:
            # Si ce n'est pas du JSON, afficher tel quel
            print(payload)
        print("-" * 50)

    def connect(self):
        print(f"🔗 Connexion au broker MQTT {MQTT_BROKER}:{MQTT_PORT}...")
        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            
            # Attendre la connexion
            timeout = 10
            while not self.connected and timeout > 0:
                time.sleep(0.5)
                timeout -= 0.5
                
            if not self.connected:
                print("❌ Timeout de connexion MQTT")
                return False
                
            return True
        except Exception as e:
            print(f"❌ Erreur de connexion MQTT: {e}")
            return False

    def send_command(self, command):
        if not self.connected:
            print("❌ Pas connecté au broker MQTT")
            return
            
        print(f"📤 Envoi commande: {command}")
        result = self.client.publish(TOPIC_COMMAND, json.dumps(command))
        
        if result.rc == 0:
            print("✅ Commande envoyée")
        else:
            print(f"❌ Échec envoi commande, code: {result.rc}")

    def test_commands(self):
        print("\n🧪 === DÉBUT DES TESTS MQTT ===")
        
        # Test 1: Activer le canal 2
        print("\n📌 Test 1: Activer le canal 2 (état ON)")
        self.send_command({"channel": 2, "state": "ON"})
        time.sleep(3)
        
        # Test 2: Mettre le canal 2 en AUTO
        print("\n📌 Test 2: Mettre le canal 2 en mode AUTO")
        self.send_command({"channel": 2, "state": "AUTO"})
        time.sleep(3)
        
        # Test 3: Désactiver le canal 1
        print("\n📌 Test 3: Désactiver le canal 1")
        self.send_command({"channel": 1, "state": "OFF"})
        time.sleep(3)
        
        # Test 4: Activer le mode manuel
        print("\n📌 Test 4: Activer le mode manuel")
        self.send_command({"manual_mode": True, "manual_state": True})
        time.sleep(3)
        
        # Test 5: Désactiver le mode manuel
        print("\n📌 Test 5: Désactiver le mode manuel")
        self.send_command({"manual_mode": False})
        time.sleep(3)
        
        # Test 6: Changer les horaires
        print("\n📌 Test 6: Changer les horaires (21h-11h)")
        schedule_cmd = {
            "start_hour": 21,
            "start_minute": 0,
            "end_hour": 11,
            "end_minute": 0
        }
        self.send_command(schedule_cmd)
        time.sleep(3)
        
        print("\n✅ === TESTS TERMINÉS ===")

    def monitor(self, duration=60):
        print(f"\n👀 Surveillance MQTT pendant {duration} secondes...")
        print("💡 Les messages reçus s'afficheront automatiquement")
        time.sleep(duration)

    def disconnect(self):
        if self.connected:
            self.client.loop_stop()
            self.client.disconnect()
            print("🔌 Déconnecté du broker MQTT")

def main():
    tester = MqttTester()
    
    if tester.connect():
        print("\n" + "="*60)
        print("🚀 Testeur MQTT ESP32 - Prêt !")
        print("="*60)
        
        try:
            # Surveiller d'abord pendant 5 secondes pour voir l'état initial
            print("\n📊 Surveillance de l'état initial...")
            time.sleep(5)
            
            # Exécuter les tests
            tester.test_commands()
            
            # Surveiller après les tests
            tester.monitor(20)
            
        except KeyboardInterrupt:
            print("\n🛑 Arrêt demandé par l'utilisateur")
        finally:
            tester.disconnect()
    else:
        print("❌ Impossible de se connecter au broker MQTT")

if __name__ == "__main__":
    main()