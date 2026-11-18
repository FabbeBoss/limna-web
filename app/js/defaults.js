// The demo farm and the demo scenarios.
//
// Everything here is invented so the app can be shown before the pilot farm's
// real figures exist. The shape of DEFAULT_CONFIG is the shape the backend
// database should hold per farm.

// The buoy runs April–October, so the demo plays on a fixed summer day
// whatever the real date is. The time of day follows the real clock.
export const DEMO_DATE = '2026-07-08';
export const SEASON_START = '2026-04-01';
export const LATITUDE = 55.7;
export const FORECAST_DAYS = 7;

export const DEFAULT_CONFIG = {
  farm: { id: 'farm-1', name: 'Ekeby gård' },
  pond: {
    id: 'pond-1',
    name: 'Bevattningsdammen',
    buoyId: 'LIMNA-001',
    a0: 3000,      // bottom area, m²
    aMax: 6000,    // area at full level, m²
    depth: 3.5,    // level when full, m
    hMin: 0.6,     // lowest level the pump can draw from, m
    table: null,   // optional [[level, volume], ...]
  },
  fields: [
    { id: 'f1', name: 'Hemåkern', areaHa: 3, crop: 'potatis', sowDate: '2026-05-02', soil: 'mo', yieldTHa: 40, sensorId: 'LIMNA-S01' },
    { id: 'f2', name: 'Dammskiftet', areaHa: 2, crop: 'gronsaker', sowDate: '2026-05-10', soil: 'sand', yieldTHa: 55, sensorId: 'LIMNA-S02' },
    { id: 'f3', name: 'Norrgärdet', areaHa: 9, crop: 'varkorn', sowDate: '2026-04-15', soil: 'lattlera', yieldTHa: 5.5, sensorId: 'LIMNA-S03' },
    { id: 'f4', name: 'Backen', areaHa: 6, crop: 'sockerbetor', sowDate: '2026-04-12', soil: 'mellanlera', yieldTHa: 70, sensorId: 'LIMNA-S04' },
  ],
  pump: {
    flowM3h: 100,
    powerKw: 30,
    maxHoursPerNight: 12,
    maxDoseMm: 30,   // largest dose in one application
  },
  prices: { elKrKwh: 1.2, waterFeeKrM3: 0 },
  thresholds: {
    doLow: 5,            // mg/L
    doCritical: 3,       // mg/L
    levelMarginM: 0.3,   // warn this far above the lowest pump level
    battLow: 20,         // %
    silentMin: 60,       // minutes without data before the buoy counts as silent
    pondDaysWarn: 21,
    pondDaysCritical: 7,
  },
};

// dryness = today's soil deficit as a share of RAW, per crop. Above 1 the field is dry.
// pastRain[0] is yesterday. forecast arrays start today.
export const SCENARIOS = {
  torr: {
    name: 'Torrperiod',
    desc: 'Tio dygn utan regn. Två fält behöver vatten i natt.',
    level: 1.72,
    tempAnomaly: 3,
    pastRain: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    forecastRain: [0, 0, 0, 0, 2, 0, 6, 0],
    forecastWind: [3, 4, 3, 5, 4, 6, 5, 4],
    doFactor: 0.86,
    inflowScale: 1,
    dryness: { gronsaker: 1.12, potatis: 0.88, sockerbetor: 0.3, varkorn: 0.45, hostvete: 0.45, raps: 0.45 },
  },
  regn: {
    name: 'Regn på väg',
    desc: 'Fälten börjar bli torra, men 16 mm regn väntas i morgon.',
    level: 2.45,
    tempAnomaly: 1,
    pastRain: [0, 0, 0, 0, 0, 0, 0],
    forecastRain: [1, 16, 9, 2, 0, 0, 3, 0],
    forecastWind: [5, 9, 7, 4, 3, 3, 4, 4],
    doFactor: 0.88,
    inflowScale: 1,
    dryness: { gronsaker: 1.04, potatis: 0.92, sockerbetor: 0.6, varkorn: 0.5, hostvete: 0.5, raps: 0.5 },
  },
  brist: {
    name: 'Vattenbrist',
    desc: 'Dammen är nästan tom och allt är torrt. Vattnet räcker inte till alla fält.',
    level: 1.02,
    tempAnomaly: 4,
    pastRain: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    forecastRain: [0, 0, 0, 0, 0, 3, 0, 0],
    forecastWind: [3, 3, 4, 4, 5, 6, 4, 4],
    doFactor: 0.5,
    inflowScale: 0.3,
    dryness: { gronsaker: 1.25, potatis: 1.15, sockerbetor: 1.02, varkorn: 0.97, hostvete: 0.97, raps: 0.97 },
  },
  lugnt: {
    name: 'Allt lugnt',
    desc: 'Det har nyss regnat. Dammen är välfylld och inget behöver vattnas i natt.',
    level: 3.1,
    tempAnomaly: 0,
    pastRain: [0, 0, 8, 22, 3, 0, 0],
    forecastRain: [0, 4, 0, 7, 0, 0, 2, 0],
    forecastWind: [4, 5, 3, 6, 4, 3, 4, 4],
    doFactor: 0.9,
    inflowScale: 1.6,
    dryness: { gronsaker: 0.12, potatis: 0.2, sockerbetor: 0.25, varkorn: 0.2, hostvete: 0.2, raps: 0.2 },
  },
};

export const DEFAULT_DEMO = { scenario: 'torr', silent: false, lowBattery: false };
