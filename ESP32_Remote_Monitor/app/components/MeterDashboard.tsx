'use client'

import { MeterData } from '../types/ESP32Types'
import { Zap, Activity, BarChart2, Plug, RefreshCw } from 'lucide-react'

interface MeterDashboardProps {
  data: MeterData | null
  loading?: boolean
  lastUpdate?: string
}

function MetricCard({
  label,
  value,
  unit,
  color = 'text-gray-900',
}: {
  label: string
  value: string | number
  unit: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-3 min-w-0">
      <span className={`text-xl font-bold font-mono ${color} truncate w-full text-center`}>
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </span>
      <span className="text-xs text-gray-500 mt-1 text-center leading-tight">{label}</span>
    </div>
  )
}

function PhaseRow({
  phase,
  v,
  i,
  p,
  pf,
}: {
  phase: string
  v: number
  i: number
  p: number
  pf: number
}) {
  const pfColor =
    Math.abs(pf) >= 0.95
      ? 'text-green-600'
      : Math.abs(pf) >= 0.85
      ? 'text-yellow-600'
      : 'text-red-600'

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-2 px-3 font-semibold text-blue-700 text-sm">{phase}</td>
      <td className="py-2 px-3 text-right font-mono text-sm text-gray-800">
        {v.toFixed(1)} <span className="text-gray-400 text-xs">V</span>
      </td>
      <td className="py-2 px-3 text-right font-mono text-sm text-gray-800">
        {i.toFixed(3)} <span className="text-gray-400 text-xs">A</span>
      </td>
      <td className="py-2 px-3 text-right font-mono text-sm text-gray-800">
        {p.toFixed(1)} <span className="text-gray-400 text-xs">W</span>
      </td>
      <td className={`py-2 px-3 text-right font-mono text-sm font-semibold ${pfColor}`}>
        {pf.toFixed(3)}
      </td>
    </tr>
  )
}

export function MeterDashboard({ data, loading, lastUpdate }: MeterDashboardProps) {
  const notConnected = !data || !data.valid || !data.connected

  return (
    <div className="card space-y-5">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Compteur RS485 — RDZD5-MID
        </h2>
        <div className="flex items-center gap-2">
          {loading && (
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              notConnected
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                notConnected ? 'bg-red-500' : 'bg-green-500'
              }`}
            />
            {notConnected ? 'Déconnecté' : 'Connecté'}
          </span>
        </div>
      </div>

      {notConnected ? (
        <div className="text-center py-8 text-gray-400">
          <Plug className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            Aucune donnée — vérifiez le câblage RS485 et l&apos;adresse esclave Modbus
          </p>
          {lastUpdate && (
            <p className="text-xs mt-1 text-gray-300">Dernière tentative : {lastUpdate}</p>
          )}
        </div>
      ) : (
        <>
          {/* Tableau par phase */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-700">Mesures par phase</h3>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
                    <th className="py-2 px-3 text-left">Phase</th>
                    <th className="py-2 px-3 text-right">Tension L-N</th>
                    <th className="py-2 px-3 text-right">Courant</th>
                    <th className="py-2 px-3 text-right">Puissance</th>
                    <th className="py-2 px-3 text-right">FP</th>
                  </tr>
                </thead>
                <tbody>
                  <PhaseRow
                    phase="L1"
                    v={Number(data.voltages_LN.v1)}
                    i={Number(data.currents.i1)}
                    p={Number(data.powers.p1_W)}
                    pf={Number(data.power_factors.pf1)}
                  />
                  <PhaseRow
                    phase="L2"
                    v={Number(data.voltages_LN.v2)}
                    i={Number(data.currents.i2)}
                    p={Number(data.powers.p2_W)}
                    pf={Number(data.power_factors.pf2)}
                  />
                  <PhaseRow
                    phase="L3"
                    v={Number(data.voltages_LN.v3)}
                    i={Number(data.currents.i3)}
                    p={Number(data.powers.p3_W)}
                    pf={Number(data.power_factors.pf3)}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Totaux système */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-gray-700">Totaux système</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Puissance active"
                value={Number(data.powers.pTotal_W).toFixed(1)}
                unit="W"
                color="text-orange-600"
              />
              <MetricCard
                label="Puissance apparente"
                value={Number(data.powers.vaTotal_VA).toFixed(1)}
                unit="VA"
                color="text-blue-600"
              />
              <MetricCard
                label="Puissance réactive"
                value={Number(data.powers.varTotal_VAr).toFixed(1)}
                unit="VAr"
                color="text-purple-600"
              />
              <MetricCard
                label="Facteur de puissance"
                value={Number(data.power_factors.pfTotal).toFixed(3)}
                unit=""
                color={
                  Math.abs(Number(data.power_factors.pfTotal)) >= 0.95
                    ? 'text-green-600'
                    : 'text-yellow-600'
                }
              />
            </div>
          </div>

          {/* Tensions L-L + fréquence */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="V L1-L2"
              value={Number(data.voltages_LL.v12).toFixed(1)}
              unit="V"
            />
            <MetricCard
              label="V L2-L3"
              value={Number(data.voltages_LL.v23).toFixed(1)}
              unit="V"
            />
            <MetricCard
              label="V L3-L1"
              value={Number(data.voltages_LL.v31).toFixed(1)}
              unit="V"
            />
            <MetricCard
              label="Fréquence"
              value={Number(data.frequency_Hz).toFixed(2)}
              unit="Hz"
              color="text-indigo-600"
            />
          </div>

          {/* Compteurs d'énergie */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-semibold text-gray-700">Compteurs d&apos;énergie</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Import actif"
                value={Number(data.energy_import_kWh).toFixed(3)}
                unit="kWh"
                color="text-green-600"
              />
              <MetricCard
                label="Export actif"
                value={Number(data.energy_export_kWh).toFixed(3)}
                unit="kWh"
                color="text-gray-600"
              />
              <MetricCard
                label="Import réactif"
                value={Number(data.energy_import_kVArh).toFixed(3)}
                unit="kVArh"
                color="text-green-500"
              />
              <MetricCard
                label="Export réactif"
                value={Number(data.energy_export_kVArh).toFixed(3)}
                unit="kVArh"
                color="text-gray-500"
              />
            </div>
          </div>

          {lastUpdate && (
            <p className="text-right text-xs text-gray-400">
              Mis à jour : {lastUpdate}
            </p>
          )}
        </>
      )}
    </div>
  )
}
