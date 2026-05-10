'use client';

import { useMQTT } from '../hooks/useMQTT';
import { Activity, Zap, TrendingUp, Battery } from 'lucide-react';

const formatPowerFactor = (pf: number): string => {
  if (!pf || isNaN(pf)) return '0.000';
  return Math.abs(pf).toFixed(3);
};

const getPowerFactorClass = (pf: number): string => {
  const absPf = Math.abs(pf);
  if (absPf >= 0.95) return 'text-green-600';
  if (absPf >= 0.85) return 'text-yellow-600'; 
  return 'text-red-600';
};

export function MQTTMeterDashboard() {
  const { status, meterData, publishMeterRequest } = useMQTT();

  const handleRefresh = () => {
    publishMeterRequest();
  };

  if (!status.connected) {
    return (
      <div className="card text-center py-8">
        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Connexion MQTT requise pour les données du compteur</p>
      </div>
    );
  }

  if (!meterData) {
    return (
      <div className="card text-center py-8">
        <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 mb-4">En attente des données du compteur RDZD5-MID...</p>
        <button 
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Demander une lecture
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statut */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Compteur Triphasé RDZD5-MID
              </h2>
              <p className="text-sm text-gray-500">
                Dernière lecture: {new Date(meterData.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            ↻ Actualiser
          </button>
        </div>
      </div>

      {/* Tensions Phase-Neutre */}
      <div className="card">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Tensions Phase-Neutre
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {meterData.voltages_LN.v1.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">V L1-N</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {meterData.voltages_LN.v2.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">V L2-N</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {meterData.voltages_LN.v3.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">V L3-N</div>
          </div>
        </div>
      </div>

      {/* Tensions Ligne-Ligne */}
      <div className="card">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Tensions Ligne-Ligne</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-900">
              {meterData.voltages_LL.v12.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">V L1-L2</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-900">
              {meterData.voltages_LL.v23.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">V L2-L3</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-900">
              {meterData.voltages_LL.v31.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">V L3-L1</div>
          </div>
        </div>
      </div>

      {/* Courants */}
      <div className="card">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" />
          Courants par Phase
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {meterData.currents_A.i1.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">A L1</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {meterData.currents_A.i2.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">A L2</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {meterData.currents_A.i3.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">A L3</div>
          </div>
        </div>
      </div>

      {/* Puissances */}
      <div className="card">
        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Battery className="w-5 h-5 text-purple-500" />
          Puissances Actives
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-xl font-semibold text-purple-600">
              {meterData.powers_W.p1.toFixed(0)}
            </div>
            <div className="text-sm text-gray-500">W L1</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-purple-600">
              {meterData.powers_W.p2.toFixed(0)}
            </div>
            <div className="text-sm text-gray-500">W L2</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-purple-600">
              {meterData.powers_W.p3.toFixed(0)}
            </div>
            <div className="text-sm text-gray-500">W L3</div>
          </div>
          <div className="text-center bg-purple-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-700">
              {meterData.powers_W.pTotal.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600 font-medium">W Total</div>
          </div>
        </div>
      </div>

      {/* Facteurs de puissance */}
      <div className="card">
        <h3 className="text-md font-semibold text-gray-900 mb-4">Facteurs de Puissance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-lg font-semibold ${getPowerFactorClass(meterData.powerFactors.pf1)}`}>
              {formatPowerFactor(meterData.powerFactors.pf1)}
            </div>
            <div className="text-sm text-gray-500">cos φ L1</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-semibold ${getPowerFactorClass(meterData.powerFactors.pf2)}`}>
              {formatPowerFactor(meterData.powerFactors.pf2)}
            </div>
            <div className="text-sm text-gray-500">cos φ L2</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-semibold ${getPowerFactorClass(meterData.powerFactors.pf3)}`}>
              {formatPowerFactor(meterData.powerFactors.pf3)}
            </div>
            <div className="text-sm text-gray-500">cos φ L3</div>
          </div>
          <div className="text-center bg-gray-50 rounded-lg p-3">
            <div className={`text-xl font-bold ${getPowerFactorClass(meterData.powerFactors.pfTotal)}`}>
              {formatPowerFactor(meterData.powerFactors.pfTotal)}
            </div>
            <div className="text-sm text-gray-600 font-medium">cos φ Global</div>
          </div>
        </div>
      </div>

      {/* Fréquence et Énergies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fréquence */}
        <div className="card text-center">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Fréquence Réseau</h3>
          <div className="text-3xl font-bold text-blue-600">
            {meterData.frequency_Hz.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">Hz</div>
        </div>

        {/* Énergies */}
        <div className="card">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Compteurs d'Énergie</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Import actif:</span>
              <span className="font-semibold text-green-600">
                {meterData.energy_import_kWh.toFixed(3)} kWh
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Export actif:</span>
              <span className="font-semibold">
                {meterData.energy_export_kWh.toFixed(3)} kWh
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Import réactif:</span>
              <span className="font-semibold text-green-600">
                {meterData.energy_import_kVArh.toFixed(3)} kVArh
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Export réactif:</span>
              <span className="font-semibold">
                {meterData.energy_export_kVArh.toFixed(3)} kVArh
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}