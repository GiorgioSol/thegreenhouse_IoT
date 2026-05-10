export interface RelayChannel {
  id: number
  name: string
  state: 0 | 1 | 2 // 0=OFF, 1=ON, 2=AUTO
  isActive: boolean
  lastChanged: string
}

export interface SystemInfo {
  uptime: number
  freeHeap: number
  totalHeap: number
  chipModel: string
  cpuFreq: number
  temperature?: number
}

export interface WifiInfo {
  ssid: string
  ip: string
  rssi: number
  mac: string
  gatewayIP: string
}

export interface ESP32Status {
  channels: RelayChannel[]
  currentTime: string
  scheduleStart: string
  scheduleEnd: string
  isScheduleActive: boolean
  systemInfo: SystemInfo
  wifiInfo: WifiInfo
  lastUpdate: string
}

export interface ScheduleConfig {
  startTime: string
  endTime: string
  enabled: boolean
}

export type ChannelState = 0 | 1 | 2

export const ChannelStateNames = {
  0: 'OFF',
  1: 'AUTO', 
  2: 'ON'
} as const

// Données du compteur RS485 RDZD5-MID (Modbus RTU)
export interface MeterData {
  connected: boolean
  valid: boolean
  timestamp: number
  errorCount?: number
  voltages_LN: { v1: number; v2: number; v3: number }
  voltages_LL: { v12: number; v23: number; v31: number }
  currents: { i1: number; i2: number; i3: number }
  powers: {
    p1_W: number; p2_W: number; p3_W: number
    pTotal_W: number; vaTotal_VA: number; varTotal_VAr: number
  }
  power_factors: { pf1: number; pf2: number; pf3: number; pfTotal: number }
  frequency_Hz: number
  energy_import_kWh: number
  energy_export_kWh: number
  energy_import_kVArh: number
  energy_export_kVArh: number
}

export const ChannelNames = {
  0: 'Lampe 1',
  1: 'Relais 2', 
  2: 'Lampe 2',
  3: 'Relais 4',
  4: 'Climat',
  5: 'Relais 6'
} as const