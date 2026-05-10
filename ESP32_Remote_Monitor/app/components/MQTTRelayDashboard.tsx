'use client';

import { useState, useEffect } from 'react';
import { useMQTT } from '../hooks/useMQTT';
import { Power, Clock, Zap, Wifi, WifiOff, Activity } from 'lucide-react';

const CHANNEL_NAMES = [
  'Éclairage Principal',
  'Éclairage Secondaire', 
  'Ventilation',
  'Pompe à Air',
  'Chauffage',
  'Canal 6'
];

const getStateButtonClass = (channelState: number, buttonState: number) => {
  const baseClass = 'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50';
  
  if (channelState === buttonState) {
    return `${baseClass} bg-gray-200 text-gray-800 border-2 border-gray-400 shadow-md`;
  } else {
    return `${baseClass} bg-white text-gray-600 hover:bg-gray-50 border border-gray-300`;
  }
};

const isInScheduleTime = (start: string, end: string): boolean => {
  if (!start || !end) return false;

  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes();
  
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startTime = startHour * 100 + startMin;
  const endTime = endHour * 100 + endMin;
  
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    return currentTime >= startTime || currentTime <= endTime;
  }
};

export function MQTTRelayDashboard() {
  const { status, relayStatus, publishRelayCommand } = useMQTT();
  const [loadingChannels, setLoadingChannels] = useState<Set<number>>(new Set());

  const handleChannelChange = async (channelId: number, newState: number) => {
    setLoadingChannels(prev => new Set(prev).add(channelId));
    
    try {
      publishRelayCommand({
        action: 'setChannel',
        channelId,
        state: newState
      });
      
      // Attendre 1 seconde pour laisser le temps à l'ESP32 de répondre
      setTimeout(() => {
        setLoadingChannels(prev => {
          const newSet = new Set(prev);
          newSet.delete(channelId);
          return newSet;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Erreur changement canal:', error);
      setLoadingChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  // Demander le statut initial et toutes les 10 secondes
  useEffect(() => {
    if (status.connected) {
      publishRelayCommand({ action: 'status' });
      
      const interval = setInterval(() => {
        publishRelayCommand({ action: 'status' });
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [status.connected, publishRelayCommand]);

  if (!status.connected && !status.connecting) {
    return (
      <div className="card text-center py-8">
        <WifiOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Connexion MQTT</h2>
        <p className="text-gray-600 mb-4">
          {status.error ? `Erreur: ${status.error}` : 'Connexion au broker MQTT...'}
        </p>
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (status.connecting) {
    return (
      <div className="card text-center py-8">
        <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Connexion MQTT en cours...</p>
      </div>
    );
  }

  if (!relayStatus) {
    return (
      <div className="card text-center py-8">
        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">En attente des données ESP32...</p>
      </div>
    );
  }

  const scheduleStart = `${relayStatus.startHour || 22}:${(relayStatus.startMinute || 0).toString().padStart(2, '0')}`;
  const scheduleEnd = `${relayStatus.endHour || 10}:${(relayStatus.endMinute || 0).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* Statut de connexion */}
      <div className="card bg-gradient-to-r from-green-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              MQTT {status.connected ? 'Connecté' : 'Déconnecté'}
            </span>
            {status.lastMessage && (
              <span className="text-sm text-gray-500">
                • Dernière comm: {status.lastMessage.toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Wifi className={`w-4 h-4 ${relayStatus.wifiConnected ? 'text-green-500' : 'text-red-500'}`} />
              <span className="text-sm">WiFi</span>
            </div>
            <div className="text-sm text-gray-600">
              Uptime: {Math.floor(relayStatus.uptime / 60)}min
            </div>
          </div>
        </div>
      </div>

      {/* Info horaires */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Informations Temporelles
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-gray-900">
              {relayStatus.currentTime}
            </div>
            <div className="text-sm text-gray-500">
              {relayStatus.currentDate} {relayStatus.ntpSynced ? '✓' : '⚠️'}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">
              {scheduleStart} → {scheduleEnd}
            </div>
            <div className="text-sm text-gray-500">Plage AUTO</div>
          </div>
          
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isInScheduleTime(scheduleStart, scheduleEnd)
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {isInScheduleTime(scheduleStart, scheduleEnd) ? '✅ Période AUTO' : '⏸️ Hors période'}
            </div>
          </div>
        </div>
      </div>

      {/* Grille des canaux */}
      <div className="grid mobile-grid gap-4 sm:gap-6">
        {relayStatus.channels.map((channel, index) => {
          const isLoading = loadingChannels.has(channel.id);
          
          return (
            <div key={channel.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${
                    channel.active ? 'text-green-500' : 'text-gray-400'
                  }`} />
                  {CHANNEL_NAMES[index] || `Canal ${channel.id + 1}`}
                </h3>
                
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  channel.active 
                    ? 'bg-green-500 text-white border-green-500' 
                    : 'bg-transparent text-gray-500 border-gray-300'
                }`}>
                  {channel.active ? 'ACTIF' : 'INACTIF'}
                </div>
              </div>

              {/* Boutons de contrôle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => handleChannelChange(channel.id, 0)}
                  disabled={isLoading}
                  className={`${getStateButtonClass(channel.state, 0)} btn-touch touch-feedback`}
                >
                  {isLoading && channel.state !== 0 ? (
                    <div className="loading-spinner mx-auto" />
                  ) : (
                    'OFF'
                  )}
                </button>
                
                <button
                  onClick={() => handleChannelChange(channel.id, 1)}
                  disabled={isLoading}
                  className={`${getStateButtonClass(channel.state, 1)} btn-touch touch-feedback`}
                >
                  {isLoading && channel.state !== 1 ? (
                    <div className="loading-spinner mx-auto" />
                  ) : (
                    'AUTO'
                  )}
                </button>
                
                <button
                  onClick={() => handleChannelChange(channel.id, 2)}
                  disabled={isLoading}
                  className={`${getStateButtonClass(channel.state, 2)} btn-touch touch-feedback`}
                >
                  {isLoading && channel.state !== 2 ? (
                    <div className="loading-spinner mx-auto" />
                  ) : (
                    'ON'
                  )}
                </button>
              </div>

              {/* Informations supplémentaires */}
              <div className="text-xs text-gray-500 space-y-1">
                <div>Mode: <span className="font-medium">
                  {channel.state === 0 ? 'OFF' : channel.state === 1 ? 'AUTO' : 'ON'}
                </span></div>
                <div>État: <span className={`font-medium ${
                  channel.active ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {channel.active ? 'Relais fermé' : 'Relais ouvert'}
                </span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="card bg-gray-50">
        <h3 className="font-medium text-gray-900 mb-3">Légende des modes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span><strong>OFF:</strong> Relais toujours ouvert</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span><strong>AUTO:</strong> Suit la programmation horaire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span><strong>ON:</strong> Relais toujours fermé</span>
          </div>
        </div>
      </div>

      {/* Informations système */}
      <div className="card bg-blue-50">
        <h3 className="font-medium text-gray-900 mb-3">Informations Système</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="font-medium text-gray-600">Mode</div>
            <div>{relayStatus.manualMode ? 'Manuel' : 'Automatique'}</div>
          </div>
          <div>
            <div className="font-medium text-gray-600">Relais actifs</div>
            <div>{relayStatus.relaysActive ? 'Oui' : 'Non'}</div>
          </div>
          <div>
            <div className="font-medium text-gray-600">Mémoire libre</div>
            <div>{Math.round(relayStatus.freeHeap / 1024)} KB</div>
          </div>
          <div>
            <div className="font-medium text-gray-600">MQTT ESP32</div>
            <div className={relayStatus.mqttConnected ? 'text-green-600' : 'text-red-600'}>
              {relayStatus.mqttConnected ? 'Connecté' : 'Déconnecté'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}