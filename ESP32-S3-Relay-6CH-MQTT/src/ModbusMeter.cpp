#include "ModbusMeter.h"
#include <string.h>

// =============================================================================
// Délais inter-trames Modbus RTU
// La doc RDZD5 recommande 60 ms minimum entre deux requêtes successives.
// =============================================================================
static const uint32_t MODBUS_INTERFRAME_MS = 60;
// Timeout de réception d'une réponse [ms]
static const uint32_t MODBUS_RESPONSE_TIMEOUT_MS = 300;

// =============================================================================
// Constructeur
// =============================================================================
ModbusMeter::ModbusMeter()
    : _serial(nullptr), _dePin(-1), _slaveAddr(1),
      _connected(false), _errorCount(0)
{
  memset(&_data, 0, sizeof(_data));
}

// =============================================================================
// begin() – Initialisation RS485
// =============================================================================
void ModbusMeter::begin(HardwareSerial& serial,
                        uint8_t txPin, uint8_t rxPin,
                        int8_t dePin,
                        uint32_t baud, uint8_t slaveAddr)
{
  _serial    = &serial;
  _dePin     = dePin;
  _slaveAddr = slaveAddr;

  // Broche DE/RE : uniquement si le transceiver n'est pas à direction auto
  if (_dePin >= 0) {
    pinMode((uint8_t)_dePin, OUTPUT);
    digitalWrite((uint8_t)_dePin, LOW); // Mode réception par défaut
  }

  // Initialisation UART (8N1 = SERIAL_8N1)
  serial.begin(baud, SERIAL_8N1, rxPin, txPin);
  delay(100); // Attente stabilisation
}

// =============================================================================
// crc16() – Calcul CRC Modbus RTU (polynôme 0xA001)
// =============================================================================
uint16_t ModbusMeter::crc16(const uint8_t* buf, size_t len)
{
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= (uint16_t)buf[i];
    for (int b = 0; b < 8; b++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

// =============================================================================
// regsToFloat() – Conversion 2 registres 16 bits → flottant IEEE754
// L'ordre par défaut du RDZD5 est : registre de poids fort en premier.
// =============================================================================
float ModbusMeter::regsToFloat(uint16_t hi, uint16_t lo)
{
  uint32_t raw = ((uint32_t)hi << 16) | (uint32_t)lo;
  float val;
  memcpy(&val, &raw, sizeof(float));
  return val;
}

// =============================================================================
// readInputRegisters() – Requête Modbus FC04
// =============================================================================
bool ModbusMeter::readInputRegisters(uint16_t startAddr, uint16_t count,
                                     uint16_t* regs)
{
  if (!_serial) return false;
  // count doit être pair (chaque valeur = 2 registres) et ≤ 80
  if (count == 0 || count > 80 || (count & 1)) return false;

  // --- Construction de la trame de requête ---
  // [addrEsclave, FC04, addrHi, addrLo, countHi, countLo, crcLo, crcHi]
  uint8_t req[8];
  req[0] = _slaveAddr;
  req[1] = 0x04;
  req[2] = (uint8_t)(startAddr >> 8);
  req[3] = (uint8_t)(startAddr & 0xFF);
  req[4] = (uint8_t)(count >> 8);
  req[5] = (uint8_t)(count & 0xFF);
  uint16_t crc = crc16(req, 6);
  req[6] = (uint8_t)(crc & 0xFF);        // CRC octet bas en premier
  req[7] = (uint8_t)(crc >> 8);

  // --- Purge du buffer de réception ---
  while (_serial->available()) _serial->read();

  // --- Passage en mode émission ---
  if (_dePin >= 0) {
    digitalWrite((uint8_t)_dePin, HIGH);
    delayMicroseconds(200); // Délai avant premier bit
  }

  _serial->write(req, 8);
  _serial->flush(); // Attente fin d'émission

  // Petit délai pour s'assurer que le dernier bit stop est émis
  // À 9600 baud : 1 caractère ≈ 1.145 ms → 2 ms de marge suffisent
  delayMicroseconds(2000);

  // --- Retour en mode réception ---
  if (_dePin >= 0) {
    digitalWrite((uint8_t)_dePin, LOW);
  }

  // --- Attente et lecture de la réponse ---
  // Longueur attendue : 3 octets entête + count*2 données + 2 CRC
  const size_t expectedLen = (size_t)(count * 2) + 5;
  size_t rxLen = 0;
  unsigned long startMs = millis();

  while ((millis() - startMs) < MODBUS_RESPONSE_TIMEOUT_MS
         && rxLen < expectedLen)
  {
    if (_serial->available()) {
      _rxBuf[rxLen++] = (uint8_t)_serial->read();
    }
  }

  // --- Validations ---
  if (rxLen < 5) {
    Serial.printf("[Modbus] Timeout : reçu %u / %u octets\n",
                  (unsigned)rxLen, (unsigned)expectedLen);
    _errorCount++;
    return false;
  }

  // Vérification adresse esclave + code fonction
  if (_rxBuf[0] != _slaveAddr) {
    Serial.printf("[Modbus] Adresse inattendue : 0x%02X\n", _rxBuf[0]);
    _errorCount++;
    return false;
  }
  if (_rxBuf[1] == (0x04 | 0x80)) {
    // Réponse exception : le compteur a renvoyé un code d'erreur
    Serial.printf("[Modbus] Exception FC04, code : 0x%02X\n", _rxBuf[2]);
    _errorCount++;
    return false;
  }
  if (_rxBuf[1] != 0x04) {
    Serial.printf("[Modbus] Code fonction inattendu : 0x%02X\n", _rxBuf[1]);
    _errorCount++;
    return false;
  }

  // Vérification du nombre d'octets de données
  uint8_t byteCount = _rxBuf[2];
  if (byteCount != (uint8_t)(count * 2)
      || rxLen < (size_t)(byteCount + 5))
  {
    Serial.printf("[Modbus] Taille incorrecte : byteCount=%u rxLen=%u\n",
                  byteCount, (unsigned)rxLen);
    _errorCount++;
    return false;
  }

  // Vérification CRC
  uint16_t rxCrc  = (uint16_t)_rxBuf[rxLen - 2]
                  | ((uint16_t)_rxBuf[rxLen - 1] << 8);
  uint16_t calcCrc = crc16(_rxBuf, rxLen - 2);
  if (rxCrc != calcCrc) {
    Serial.printf("[Modbus] CRC invalide : reçu=0x%04X calculé=0x%04X\n",
                  rxCrc, calcCrc);
    _errorCount++;
    return false;
  }

  // --- Extraction des valeurs de registres (big-endian 16 bits) ---
  for (uint16_t i = 0; i < count; i++) {
    regs[i] = ((uint16_t)_rxBuf[3 + i * 2] << 8)
            |  (uint16_t)_rxBuf[4 + i * 2];
  }

  return true;
}

// =============================================================================
// readAllData() – Lecture complète en 4 requêtes groupées
//
// Taille maximale par requête : 40 valeurs = 80 registres (limite RDZD5)
//
// Lot 1 – addr 0x0000, 36 registres : V1-V3, I1-I3, P1-P3, VA1-VA3,
//          VAr1-VAr3, PF1-PF3 (18 flottants, contiguous)
// Lot 2 – addr 0x0034, 12 registres : Ptot, (skip), VAtot, (skip),
//          VArtot, PFtot
// Lot 3 – addr 0x0046, 10 registres : Freq, ImpkWh, ExpkWh,
//          ImpkVArh, ExpkVArh
// Lot 4 – addr 0x00C8,  6 registres : V12, V23, V31
// =============================================================================
bool ModbusMeter::readAllData()
{
  bool ok = true;
  uint16_t regs[80];

  // ------------------------------------------------------------------
  // Lot 1 : mesures par phase – 36 registres (18 flottants consécutifs)
  // ------------------------------------------------------------------
  if (readInputRegisters(0x0000, 36, regs)) {
    _data.v1   = regsToFloat(regs[0],  regs[1]);
    _data.v2   = regsToFloat(regs[2],  regs[3]);
    _data.v3   = regsToFloat(regs[4],  regs[5]);
    _data.i1   = regsToFloat(regs[6],  regs[7]);
    _data.i2   = regsToFloat(regs[8],  regs[9]);
    _data.i3   = regsToFloat(regs[10], regs[11]);
    _data.p1   = regsToFloat(regs[12], regs[13]);
    _data.p2   = regsToFloat(regs[14], regs[15]);
    _data.p3   = regsToFloat(regs[16], regs[17]);
    _data.va1  = regsToFloat(regs[18], regs[19]);
    _data.va2  = regsToFloat(regs[20], regs[21]);
    _data.va3  = regsToFloat(regs[22], regs[23]);
    _data.var1 = regsToFloat(regs[24], regs[25]);
    _data.var2 = regsToFloat(regs[26], regs[27]);
    _data.var3 = regsToFloat(regs[28], regs[29]);
    _data.pf1  = regsToFloat(regs[30], regs[31]);
    _data.pf2  = regsToFloat(regs[32], regs[33]);
    _data.pf3  = regsToFloat(regs[34], regs[35]);
  } else {
    ok = false;
    Serial.println("[Modbus] Lot 1 (phases) : echec");
  }
  delay(MODBUS_INTERFRAME_MS);

  // ------------------------------------------------------------------
  // Lot 2 : totaux système – 12 registres
  //   0x0034 Ptot   [0,1]
  //   0x0036 (vide) [2,3]
  //   0x0038 VAtot  [4,5]
  //   0x003A (vide) [6,7]
  //   0x003C VArtot [8,9]
  //   0x003E PFtot  [10,11]
  // ------------------------------------------------------------------
  if (readInputRegisters(0x0034, 12, regs)) {
    _data.pTotal   = regsToFloat(regs[0],  regs[1]);
    _data.vaTotal  = regsToFloat(regs[4],  regs[5]);
    _data.varTotal = regsToFloat(regs[8],  regs[9]);
    _data.pfTotal  = regsToFloat(regs[10], regs[11]);
  } else {
    ok = false;
    Serial.println("[Modbus] Lot 2 (totaux) : echec");
  }
  delay(MODBUS_INTERFRAME_MS);

  // ------------------------------------------------------------------
  // Lot 3 : fréquence et énergie – 10 registres
  //   0x0046 Freq      [0,1]
  //   0x0048 ImpkWh    [2,3]
  //   0x004A ExpkWh    [4,5]
  //   0x004C ImpkVArh  [6,7]
  //   0x004E ExpkVArh  [8,9]
  // ------------------------------------------------------------------
  if (readInputRegisters(0x0046, 10, regs)) {
    _data.frequency   = regsToFloat(regs[0], regs[1]);
    _data.kwhImport   = regsToFloat(regs[2], regs[3]);
    _data.kwhExport   = regsToFloat(regs[4], regs[5]);
    _data.kVArhImport = regsToFloat(regs[6], regs[7]);
    _data.kVArhExport = regsToFloat(regs[8], regs[9]);
  } else {
    ok = false;
    Serial.println("[Modbus] Lot 3 (energie) : echec");
  }
  delay(MODBUS_INTERFRAME_MS);

  // ------------------------------------------------------------------
  // Lot 4 : tensions ligne à ligne – 6 registres
  //   0x00C8 V12 [0,1]
  //   0x00CA V23 [2,3]
  //   0x00CC V31 [4,5]
  // ------------------------------------------------------------------
  if (readInputRegisters(0x00C8, 6, regs)) {
    _data.v12 = regsToFloat(regs[0], regs[1]);
    _data.v23 = regsToFloat(regs[2], regs[3]);
    _data.v31 = regsToFloat(regs[4], regs[5]);
  } else {
    ok = false;
    Serial.println("[Modbus] Lot 4 (V L-L) : echec");
  }

  _connected      = ok;
  _data.valid     = ok;
  _data.timestamp = millis();

  return ok;
}
