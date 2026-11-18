// LIMNA calculations.
//
// Pure functions only: no DOM, no storage, no clock. Everything the app tells
// the farmer can be traced back to one of these. Tested in tests/calc.test.js.
//
// Units: level m, area m², volume m³, rain / ET / irrigation mm, soil moisture
// as a fraction (0.23 = 23 %), field area ha, money kr.

// Starting values from the brief. Calibrate against real measurements.
export const OPEN_WATER_FACTOR = 1.05;      // evaporation from open water = 1.05 × ET0
export const EFFECTIVE_RAIN_MIN_MM = 5;     // rain at or below this does not reach the roots
export const EFFECTIVE_RAIN_FRACTION = 0.8;
export const RAIN_HOLD_MM = 10;             // do not irrigate ahead of more rain than this
export const RAIN_LOOKAHEAD_DAYS = 2;
export const M3_PER_MM_HA = 10;             // 1 mm on 1 ha = 10 m³

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ---------------------------------------------------------------------------
// Pond
// pond = { a0, aMax, depth, hMin, table? }
// table = [[level, volume], ...] sorted by level, used instead of the formula.
// ---------------------------------------------------------------------------

/** Surface area at level h, linear between the bottom and the full level. */
export function pondArea(h, pond) {
  const x = clamp(h, 0, pond.depth);
  return pond.a0 + ((pond.aMax - pond.a0) * x) / pond.depth;
}

function interpolate(table, x, from, to) {
  if (x <= table[0][from]) return table[0][to];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1];
    const b = table[i];
    if (x <= b[from]) {
      const t = (x - a[from]) / (b[from] - a[from]);
      return a[to] + t * (b[to] - a[to]);
    }
  }
  return table[table.length - 1][to];
}

/** Volume at level h: V(h) = A0·h + (Amax − A0)·h² / (2H), or the farmer's own table. */
export function pondVolume(h, pond) {
  if (pond.table && pond.table.length >= 2) return interpolate(pond.table, h, 0, 1);
  const x = clamp(h, 0, pond.depth);
  return pond.a0 * x + ((pond.aMax - pond.a0) * x * x) / (2 * pond.depth);
}

/** Inverse of pondVolume. */
export function pondLevelFromVolume(v, pond) {
  if (pond.table && pond.table.length >= 2) return interpolate(pond.table, v, 1, 0);
  const vol = clamp(v, 0, pondVolume(pond.depth, pond));
  const k = (pond.aMax - pond.a0) / (2 * pond.depth);
  if (Math.abs(k) < 1e-9) return vol / pond.a0;
  return (-pond.a0 + Math.sqrt(pond.a0 * pond.a0 + 4 * k * vol)) / (2 * k);
}

/** Water the pump can actually reach: V(h) − V(hMin). */
export function usableVolume(h, pond) {
  return Math.max(0, pondVolume(h, pond) - pondVolume(pond.hMin, pond));
}

/** Usable volume when the pond is full. */
export function usableCapacity(pond) {
  return usableVolume(pond.depth, pond);
}

/**
 * Net withdrawal over one day, from the level change corrected for weather:
 * U = V_yesterday − V_today + (P − 1.05·ET0)·A / 1000
 * Positive = water taken out. Negative = more came in than went out.
 */
export function dailyWithdrawal({ vYesterday, vToday, rainMm, et0Mm, areaM2 }) {
  return vYesterday - vToday + ((rainMm - OPEN_WATER_FACTOR * et0Mm) * areaM2) / 1000;
}

/**
 * Water balance over a run of days.
 * days = [{ level, rainMm, et0Mm, irrigationM3 }], oldest first. level is the
 * reading at the start of each day, and one extra entry at the end closes the
 * last day (its weather and irrigation fields are ignored).
 *
 * Logged irrigation is the known withdrawal. What the level change cannot
 * explain beyond that is inflow, or unlogged use.
 */
export function waterBalance(days, pond) {
  const rows = [];
  for (let i = 0; i < days.length - 1; i++) {
    const d = days[i];
    const area = pondArea(d.level, pond);
    const vStart = pondVolume(d.level, pond);
    const vEnd = pondVolume(days[i + 1].level, pond);
    const rainM3 = (d.rainMm * area) / 1000;
    const evapM3 = (OPEN_WATER_FACTOR * d.et0Mm * area) / 1000;
    const net = dailyWithdrawal({ vYesterday: vStart, vToday: vEnd, rainMm: d.rainMm, et0Mm: d.et0Mm, areaM2: area });
    const logged = d.irrigationM3 || 0;
    let usedM3;
    let inflowM3;
    if (logged > 0) {
      usedM3 = Math.max(logged, net);
      inflowM3 = Math.max(0, logged - net);
    } else {
      usedM3 = Math.max(0, net);
      inflowM3 = Math.max(0, -net);
    }
    rows.push({ netWithdrawalM3: net, usedM3, inflowM3, rainM3, evapM3, changeM3: vEnd - vStart });
  }
  const sum = (key) => rows.reduce((a, r) => a + r[key], 0);
  return {
    rows,
    usedM3: sum('usedM3'),
    inflowM3: sum('inflowM3'),
    rainM3: sum('rainM3'),
    evapM3: sum('evapM3'),
    changeM3: sum('changeM3'),
  };
}

/**
 * Days until the usable volume is gone at the average net withdrawal of the
 * given days (normally the last seven). Infinity when the pond is not sinking.
 */
export function daysLeft(usableM3, withdrawalsM3) {
  const avg = mean(withdrawalsM3);
  if (avg <= 0) return Infinity;
  return usableM3 / avg;
}

// ---------------------------------------------------------------------------
// Crop development
// ---------------------------------------------------------------------------

/**
 * Stage, crop coefficient and rooting depth a given number of days after sowing.
 * Kc is constant in the initial and mid stages and linear in between (FAO-56).
 * Roots grow linearly from 0.15 m at sowing to rootMax at the start of mid-season.
 */
export function cropStage(crop, daysSinceSowing) {
  const [l1, l2, l3, l4] = crop.stages;
  const [kIni, kMid, kEnd] = crop.kc;
  const d = Math.max(0, daysSinceSowing);
  const rootStart = 0.15;
  const rootDepth = Math.min(crop.rootMax, rootStart + ((crop.rootMax - rootStart) * d) / (l1 + l2));
  let index;
  let kc;
  if (d < l1) {
    index = 0;
    kc = kIni;
  } else if (d < l1 + l2) {
    index = 1;
    kc = kIni + ((kMid - kIni) * (d - l1)) / l2;
  } else if (d < l1 + l2 + l3) {
    index = 2;
    kc = kMid;
  } else if (d < l1 + l2 + l3 + l4) {
    index = 3;
    kc = kMid + ((kEnd - kMid) * (d - l1 - l2 - l3)) / l4;
  } else {
    index = 4;
    kc = kEnd;
  }
  return { index, kc, rootDepth, day: d, seasonDays: l1 + l2 + l3 + l4 };
}

// ---------------------------------------------------------------------------
// Soil water budget (FAO-56)
// soil = { fc, wp } as fractions
// ---------------------------------------------------------------------------

/** Total available water in the root zone, mm. */
export function totalAvailableWater(soil, rootDepth) {
  return 1000 * (soil.fc - soil.wp) * rootDepth;
}

/** Readily available water, mm: the part the crop takes without stress. */
export function readilyAvailableWater(taw, p = 0.5) {
  return p * taw;
}

/** Root-zone deficit below field capacity, mm. Zero when the soil is wetter than fc. */
export function soilDeficit(theta, soil, rootDepth) {
  return Math.max(0, 1000 * (soil.fc - theta) * rootDepth);
}

/** Soil moisture that corresponds to a deficit. Inverse of soilDeficit. */
export function thetaFromDeficit(deficitMm, soil, rootDepth) {
  return soil.fc - deficitMm / (1000 * rootDepth);
}

/** Rain that reaches the roots: 0.8 × P when P > 5 mm, otherwise nothing. */
export function effectiveRain(rainMm) {
  return rainMm > EFFECTIVE_RAIN_MIN_MM ? EFFECTIVE_RAIN_FRACTION * rainMm : 0;
}

/**
 * One day of the budget: D(i+1) = D(i) + Kc·ET0 − P_eff − I
 * Kept between 0 (field capacity, surplus drains away) and TAW (wilting point).
 */
export function stepDeficit(deficitMm, day, taw) {
  const next = deficitMm + day.kc * day.et0 - effectiveRain(day.rain) - (day.irrigation || 0);
  return clamp(next, 0, taw);
}

/**
 * Deficit at the start of each day over a forecast, without irrigation.
 * Returns days.length + 1 values; the first is today's measured deficit.
 */
export function projectDeficit(d0, days, taw) {
  const out = [d0];
  for (const day of days) out.push(stepDeficit(out[out.length - 1], day, taw));
  return out;
}

/** Whole days until the deficit reaches RAW if no rain falls and nothing is irrigated. */
export function daysWithoutWater(deficitMm, raw, etcMmPerDay) {
  if (deficitMm >= raw) return 0;
  if (etcMmPerDay <= 0) return Infinity;
  return (raw - deficitMm) / etcMmPerDay;
}

/**
 * The irrigation rule, run evening by evening over the forecast.
 *
 * On the evening of day i:
 *   - irrigate when the deficit has passed RAW, or will pass it by the next evening
 *   - unless more than RAIN_HOLD_MM of rain is forecast for one of the two coming days
 *   - dose = the deficit, so the soil is filled to field capacity, capped by maxDoseMm
 *
 * days = [{ kc, et0, rain }], today first.
 * Returns
 *   events: [{ night, doseMm, deficitMm }]   night 0 = tonight
 *   holds:  [{ night, rainDay, rainMm }]     irrigation was due but rain is coming
 *   withoutIrrigation / withIrrigation: deficit at the start of each day
 */
export function irrigationSchedule({ d0, taw, raw, days, maxDoseMm = Infinity, minDoseMm = 5 }) {
  const events = [];
  const holds = [];
  const withIrrigation = [d0];
  let d = d0;
  for (let i = 0; i < days.length; i++) {
    const evening = stepDeficit(d, days[i], taw);
    const tomorrow = days[i + 1] ? stepDeficit(evening, days[i + 1], taw) : evening;
    const due = evening >= raw || tomorrow >= raw;
    let rainDay = -1;
    for (let j = i + 1; j <= i + RAIN_LOOKAHEAD_DAYS && j < days.length; j++) {
      if (days[j].rain > RAIN_HOLD_MM) {
        rainDay = j;
        break;
      }
    }
    let dose = 0;
    if (due && rainDay >= 0) {
      holds.push({ night: i, rainDay, rainMm: days[rainDay].rain });
    } else if (due) {
      dose = Math.min(evening, maxDoseMm);
      if (dose >= minDoseMm) events.push({ night: i, doseMm: dose, deficitMm: evening });
      else dose = 0;
    }
    d = evening - dose;
    withIrrigation.push(d);
  }
  return { events, holds, withIrrigation, withoutIrrigation: projectDeficit(d0, days, taw) };
}

// ---------------------------------------------------------------------------
// Yield and money (FAO-33)
// ---------------------------------------------------------------------------

/** Water stress coefficient: 1 while D ≤ RAW, then falling linearly to 0 at TAW. */
export function stressCoefficient(deficitMm, taw, raw) {
  if (deficitMm <= raw) return 1;
  if (taw <= raw) return 0;
  return clamp((taw - deficitMm) / (taw - raw), 0, 1);
}

/**
 * Crop water demand and actual use over a forecast.
 * ETc = Kc·ET0 and ETa = Ks·Kc·ET0, with Ks from the deficit at the start of each day.
 */
export function evapotranspiration(deficits, days, taw, raw) {
  let etc = 0;
  let eta = 0;
  for (let i = 0; i < days.length; i++) {
    const demand = days[i].kc * days[i].et0;
    etc += demand;
    eta += stressCoefficient(deficits[i], taw, raw) * demand;
  }
  return { etc, eta, shortfall: etc - eta };
}

/** Value of the standing crop: area × expected yield × price. */
export function cropValue(areaHa, yieldTHa, priceKrT) {
  return areaHa * yieldTHa * priceKrT;
}

/** Relative yield loss: Ky × (1 − ETa/ETc), between 0 and 1. */
export function yieldLossFraction(ky, etaOverEtc) {
  return clamp(ky * (1 - etaOverEtc), 0, 1);
}

/**
 * Yield loss in kr from a period of water shortage.
 * FAO-33 relates the loss to ETa/ETc over the whole season, so the shortfall
 * of the period (mm) is set against the crop's water use for the season.
 */
export function yieldLossKr({ valueKr, ky, shortfallMm, seasonEtcMm }) {
  const ratio = 1 - clamp(shortfallMm / seasonEtcMm, 0, 1);
  return yieldLossFraction(ky, ratio) * valueKr;
}

// ---------------------------------------------------------------------------
// Pump and cost
// ---------------------------------------------------------------------------

/** Volume for a dose on a field: 1 mm on 1 ha = 10 m³. */
export function irrigationVolume(doseMm, areaHa) {
  return doseMm * areaHa * M3_PER_MM_HA;
}

/** Pump running time in hours for a dose on a field. */
export function pumpHours(doseMm, areaHa, flowM3h) {
  return irrigationVolume(doseMm, areaHa) / flowM3h;
}

/** Cost of running the pump, plus a water fee when there is one. */
export function irrigationCost({ hours, powerKw, elPriceKrKwh, volumeM3 = 0, waterFeeKrM3 = 0 }) {
  return hours * powerKw * elPriceKrKwh + volumeM3 * waterFeeKrM3;
}

/** Cost in kr of putting 1 mm on a whole field. */
export function costPerMm(areaHa, pump, elPriceKrKwh, waterFeeKrM3 = 0) {
  const volumeM3 = irrigationVolume(1, areaHa);
  return irrigationCost({
    hours: volumeM3 / pump.flowM3h,
    powerKw: pump.powerKw,
    elPriceKrKwh,
    volumeM3,
    waterFeeKrM3,
  });
}

// ---------------------------------------------------------------------------
// Sharing the water
// ---------------------------------------------------------------------------

/**
 * Hand out pond water and pump hours to the requested irrigations.
 * The field that saves the most kr per m³ is served first, whichever night it
 * is due, so water is held back for it.
 *
 * requests = [{ key, fieldId, night, volumeM3, valuePerM3 }]
 * Returns grants in the same order as requests:
 *   [{ ...request, grantedM3, limit }]   limit = null | 'water' | 'pump'
 */
export function allocateWater(requests, { usableM3, flowM3h, maxHoursPerNight }) {
  const nightCapacity = flowM3h * maxHoursPerNight;
  const usedPerNight = new Map();
  let water = usableM3;
  const order = requests
    .map((r, index) => ({ r, index }))
    .sort((a, b) => b.r.valuePerM3 - a.r.valuePerM3 || a.r.night - b.r.night || a.index - b.index);
  const grants = new Array(requests.length);
  for (const { r, index } of order) {
    const pumpLeft = nightCapacity - (usedPerNight.get(r.night) || 0);
    const granted = Math.max(0, Math.min(r.volumeM3, pumpLeft, water));
    let limit = null;
    if (granted < r.volumeM3 - 1e-6) limit = water <= pumpLeft ? 'water' : 'pump';
    usedPerNight.set(r.night, (usedPerNight.get(r.night) || 0) + granted);
    water -= granted;
    grants[index] = { ...r, grantedM3: granted, limit };
  }
  return { grants, remainingM3: water };
}
