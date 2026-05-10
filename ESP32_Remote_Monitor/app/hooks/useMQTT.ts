'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';

export interface MQTTStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: Date | null;
}

export interface RelayStatus {
  relaysActive: boolean;
  manualMode: boolean;
  wifiConnected: boolean;
  mqttConnected: boolean;
  freeHeap: number;
  uptime: number;
  currentTime: string;
  currentDate: string;
  ntpSynced: boolean;
  channels: Array<{
    id: number;
    state: number;
    active: boolean;
  }>;
}

export interface MeterData {
  voltages_LN: { v1: number; v2: number; v3: number };
  voltages_LL: { v12: number; v23: number; v31: number };
  currents_A: { i1: number; i2: number; i3: number };
  powers_W: { p1: number; p2: number; p3: number; pTotal: number };
  powerFactors: { pf1: number; pf2: number; pf3: number; pfTotal: number };
  frequency_Hz: number;
  energy_import_kWh: number;
  energy_export_kWh: number;
  energy_import_kVArh: number;
  energy_export_kVArh: number;
  timestamp: string;
}

const MQTT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const TOPICS = {
  relay: {
    status: 'esp32/relay/status',
    command: 'esp32/relay/command',
    schedule: 'esp32/relay/schedule',
    heartbeat: 'esp32/relay/heartbeat'
  },
  meter: {
    data: 'esp32/meter/data',
    request: 'esp32/meter/request'
  }
};

export function useMQTT() {
  const [status, setStatus] = useState<MQTTStatus>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null
  });

  const [relayStatus, setRelayStatus] = useState<RelayStatus | null>(null);
  const [meterData, setMeterData] = useState<MeterData | null>(null);
  
  const clientRef = useRef<MqttClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (clientRef.current?.connected) {
      return;
    }

    setStatus(prev => ({ ...prev, connecting: true, error: null }));

    try {
      const client = mqtt.connect(MQTT_BROKER, {
        clientId: `thegreenhouse-iot-${Math.random().toString(16).substr(2, 8)}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 5000,
        keepalive: 60
      });

      client.on('connect', () => {
        console.log('[MQTT] Connecté au broker');
        setStatus({
          connected: true,
          connecting: false,
          error: null,
          lastMessage: new Date()
        });

        // S'abonner aux topics
        Object.values(TOPICS.relay).forEach(topic => {
          client.subscribe(topic, { qos: 1 });
        });
        Object.values(TOPICS.meter).forEach(topic => {
          client.subscribe(topic, { qos: 1 });
        });

        // Demander le statut initial
        client.publish(TOPICS.relay.command, JSON.stringify({ action: 'status' }), { qos: 1 });
        client.publish(TOPICS.meter.request, JSON.stringify({ action: 'read' }), { qos: 1 });
      });

      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          setStatus(prev => ({ ...prev, lastMessage: new Date() }));

          switch (topic) {
            case TOPICS.relay.status:
            case TOPICS.relay.heartbeat:
              setRelayStatus(data);
              break;
            case TOPICS.meter.data:
              setMeterData(data);
              break;
          }
        } catch (error) {
          console.error('[MQTT] Erreur parsing message:', error);
        }
      });

      client.on('error', (error) => {
        console.error('[MQTT] Erreur:', error);
        setStatus(prev => ({
          ...prev,
          connected: false,
          connecting: false,
          error: error.message
        }));
      });

      client.on('close', () => {
        console.log('[MQTT] Connexion fermée');
        setStatus(prev => ({
          ...prev,
          connected: false,
          connecting: false
        }));

        // Tentative de reconnexion après 5 secondes
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      });

      clientRef.current = client;

    } catch (error) {
      console.error('[MQTT] Erreur connexion:', error);
      setStatus(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion'
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
    }
    
    setStatus({
      connected: false,
      connecting: false,
      error: null,
      lastMessage: null
    });
  }, []);

  const publishRelayCommand = useCallback((command: any) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(TOPICS.relay.command, JSON.stringify(command), { qos: 1 });
    }
  }, []);

  const publishMeterRequest = useCallback(() => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(TOPICS.meter.request, JSON.stringify({ action: 'read' }), { qos: 1 });
    }
  }, []);

  // Connexion automatique au montage
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Polling des données du compteur toutes les 30 secondes
  useEffect(() => {
    if (status.connected) {
      const interval = setInterval(publishMeterRequest, 30000);
      return () => clearInterval(interval);
    }
  }, [status.connected, publishMeterRequest]);

  return {
    status,
    relayStatus,
    meterData,
    connect,
    disconnect,
    publishRelayCommand,
    publishMeterRequest
  };
}