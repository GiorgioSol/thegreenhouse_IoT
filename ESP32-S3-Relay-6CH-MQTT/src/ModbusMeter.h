#pragma once
#include <Arduino.h>

// =============================================================================
// Adresses des registres d'entrée (Input Registers) du compteur RDZD5-MID
// Format : adresses 0-based (numéro de registre Modbus - 1)
// Chaque paramètre occupe 2 registres consécutifs (flottant IEEE754 32 bits)
// Lecture via Function Code 04
// =============================================================================
namespace RDZD5Reg {
  // ---- Tensions de phase (L-N) [V] ----
  static const uint16_t V1           = 0x0000; // Phase 1 tension L-N
  static const uint16_t V2           = 0x0002; // Phase 2 tension L-N
  static const uint16_t V3           = 0x0004; // Phase 3 tension L-N
  // ---- Courants de phase [A] ----
  static const uint16_t I1           = 0x0006; // Phase 1 courant
  static const uint16_t I2           = 0x0008; // Phase 2 courant
  static const uint16_t I3           = 0x000A; // Phase 3 courant
  // ---- Puissances actives [W] ----
  static const uint16_t P1           = 0x000C; // Phase 1 puissance active
  static const uint16_t P2           = 0x000E; // Phase 2 puissance active
  static const uint16_t P3           = 0x0010; // Phase 3 puissance active
  // ---- Puissances apparentes [VA] ----
  static const uint16_t VA1          = 0x0012;
  static const uint16_t VA2          = 0x0014;
  static const uint16_t VA3          = 0x0016;
  // ---- Puissances réactives [VAr] ----
  static const uint16_t VAR1         = 0x0018;
  static const uint16_t VAR2         = 0x001A;
  static const uint16_t VAR3         = 0x001C;
  // ---- Facteurs de puissance ----
  static const uint16_t PF1          = 0x001E;
  static const uint16_t PF2          = 0x0020;
  static const uint16_t PF3          = 0x0022;
  // ---- Totaux système ----
  static const uint16_t P_TOTAL      = 0x0034; // Puissance totale [W]
  static const uint16_t VA_TOTAL     = 0x0038; // VA total
  static const uint16_t VAR_TOTAL    = 0x003C; // VAr total
  static const uint16_t PF_TOTAL     = 0x003E; // Facteur de puissance total
  // ---- Fréquence et énergie ----
  static const uint16_t FREQ         = 0x0046; // Fréquence [Hz]
  static const uint16_t KWH_IMPORT   = 0x0048; // Import total [kWh]
  static const uint16_t KWH_EXPORT   = 0x004A; // Export total [kWh]
  static const uint16_t KVARH_IMPORT = 0x004C; // Import réactif [kVArh]
  static const uint16_t KVARH_EXPORT = 0x004E; // Export réactif [kVArh]
  // ---- Tensions ligne à ligne [V] ----
  static const uint16_t V12          = 0x00C8; // L1-L2
  static const uint16_t V23          = 0x00CA; // L2-L3
  static const uint16_t V31          = 0x00CC; // L3-L1
}

// =============================================================================
// Structure de données du compteur
// =============================================================================
struct MeterData {
  // Tensions de phase (L-N) [V]
  float v1, v2, v3;
  // Courants de phase [A]
  float i1, i2, i3;
  // Puissances actives [W]
  float p1, p2, p3;
  // Puissances apparentes [VA]
  float va1, va2, va3;
  // Puissances réactives [VAr]
  float var1, var2, var3;
  // Facteurs de puissance (signés)
  float pf1, pf2, pf3;
  // Totaux système
  float pTotal;         // W
  float vaTotal;        // VA
  float varTotal;       // VAr
  float pfTotal;
  // Fréquence [Hz]
  float frequency;
  // Compteurs d'énergie
  float kwhImport;      // kWh
  float kwhExport;      // kWh
  float kVArhImport;    // kVArh
  float kVArhExport;    // kVArh
  // Tensions ligne à ligne [V]
  float v12, v23, v31;

  bool valid;
  unsigned long timestamp;
};

// =============================================================================
// Classe ModbusMeter
// Implémente la communication Modbus RTU RS485 avec le compteur RDZD5-MID
// =============================================================================
class ModbusMeter {
public:
  ModbusMeter();

  /**
   * Initialise l'interface RS485/Modbus RTU.
   *
   * @param serial     Instance HardwareSerial à utiliser (ex: Serial2)
   * @param txPin      Broche TX de l'UART
   * @param rxPin      Broche RX de l'UART
   * @param dePin      Broche DE/RE du transceiver RS485
   *                   (HIGH = transmission, LOW = réception)
   *                   Passer -1 si le transceiver est à direction automatique
   *                   (cas de la carte Waveshare ESP32-S3-Relay-6CH)
   * @param baud       Vitesse en bauds (défaut : 9600)
   * @param slaveAddr  Adresse Modbus esclave (défaut : 1, plage 1-247)
   */
  void begin(HardwareSerial& serial,
             uint8_t txPin,
             uint8_t rxPin,
             int8_t  dePin   = -1,
             uint32_t baud       = 9600,
             uint8_t  slaveAddr  = 1);

  /**
   * Lit toutes les données du compteur en 4 requêtes groupées.
   * Durée approximative : 400-800 ms selon les temps de réponse.
   *
   * @return true si toutes les lectures ont réussi
   */
  bool readAllData();

  /** Accès aux dernières données lues. */
  const MeterData& getData() const { return _data; }

  /** Retourne true si la dernière lecture complète a réussi. */
  bool isConnected() const { return _connected; }

  /** Nombre total d'erreurs de communication depuis le démarrage. */
  uint32_t getErrorCount() const { return _errorCount; }

  /** Réinitialise le compteur d'erreurs. */
  void resetErrorCount() { _errorCount = 0; }

private:
  HardwareSerial* _serial;
  int8_t          _dePin;   // -1 = direction automatique (pas de pin DE/RE)
  uint8_t         _slaveAddr;
  MeterData       _data;
  bool            _connected;
  uint32_t        _errorCount;
  uint8_t         _rxBuf[256];

  /** Calcul CRC16 Modbus (polynôme 0xA001). */
  uint16_t crc16(const uint8_t* buf, size_t len);

  /**
   * Envoie une requête FC04 (Read Input Registers) et retourne les
   * valeurs brutes des registres dans 'regs'.
   *
   * @param startAddr  Adresse de départ (0-based)
   * @param count      Nombre de registres 16 bits à lire (doit être pair)
   * @param regs       Tableau de destination (taille >= count)
   * @return true en cas de succès
   */
  bool readInputRegisters(uint16_t startAddr, uint16_t count, uint16_t* regs);

  /**
   * Convertit deux registres 16 bits (hi, lo) en un flottant IEEE754.
   * Ordre : registre de poids fort en premier (défaut RDZD5).
   */
  static float regsToFloat(uint16_t hi, uint16_t lo);
};
