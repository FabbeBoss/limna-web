// Simulation mode: stands in for the buoy, the soil sensors, the weather
// service and the price source. It returns the same kind of raw readings the
// backend will deliver, and nothing derived from them. Volumes, deficits,
// advice and money are all worked out in model.js with the functions in calc.js.
//
// The same inputs always give the same data (seeded random numbers).

import * as calc from './calc.js';
import { CROPS, SOILS } from './crops.js';
import { SCENARIOS, SEASON_START, LATITUDE, FORECAST_DAYS } from './defaults.js';
import { DAY_MS, dayNum, isoFromDayNum, localMidnight, dayOfYear, clamp } from './util.js';

// --- Seeded randomness -----------------------------------------------------

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** Repeatable noise in [-1, 1] for a timestamp, so a reading never changes between renders. */
function noise(ts, salt) {
  const x = Math.sin((ts / 60000) * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const round = (x, digits) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

// --- Weather ---------------------------------------------------------------

/** Reference evapotranspiration, mm/day (Hargreaves, FAO-56 eq. 52). */
export function et0Hargreaves(tMin, tMax, latitudeDeg, doy) {
  const phi = (latitudeDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  const ra = ((24 * 60) / Math.PI) * 0.082 * dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  const tMean = (tMin + tMax) / 2;
  return Math.max(0, 0.0023 * 0.408 * ra * (tMean + 17.8) * Math.sqrt(Math.max(0, tMax - tMin)));
}

function makeWeather(scn, startNum, todayNum, seed) {
  const r = rng(`${seed}/weather`);
  const days = [];
  let anomaly = 0;
  let wet = false;
  for (let n = startNum; n <= todayNum + FORECAST_DAYS; n++) {
    const date = isoFromDayNum(n);
    const doy = dayOfYear(date);
    const climate = 8.5 + 9.5 * Math.sin((2 * Math.PI * (doy - 115)) / 365);
    anomaly = 0.7 * anomaly + gauss(r) * 1.6;
    wet = r() < (wet ? 0.55 : 0.27);
    let rain = wet ? round(-Math.log(1 - r()) * 4.8 + 0.4, 1) : 0;
    let wind = round(2.5 + Math.abs(gauss(r)) * 1.8 + (wet ? 1.5 : 0), 1);
    let tAnomaly = anomaly;

    const rel = n - todayNum; // negative = past, 0 = today, positive = forecast
    if (rel >= 0) {
      rain = scn.forecastRain[rel] ?? 0;
      wind = scn.forecastWind[rel] ?? 4;
      tAnomaly = scn.tempAnomaly + anomaly * 0.25;
    } else if (-rel <= scn.pastRain.length) {
      rain = scn.pastRain[-rel - 1];
      tAnomaly = scn.tempAnomaly + anomaly * 0.25;
    }

    const tMean = climate + tAnomaly;
    const spread = rain > 1 ? 3 : 5.5;
    const tMin = round(tMean - spread, 1);
    const tMax = round(tMean + spread, 1);
    const et0 = round(et0Hargreaves(tMin, tMax, LATITUDE, doy) * (rain > 3 ? 0.8 : 1), 1);
    days.push({ date, tMin, tMax, rain, et0, wind });
  }
  return days;
}

// --- Soil moisture ---------------------------------------------------------

// Built backwards from the dryness the scenario wants today, with the same
// water budget the app uses forwards. That way the history is consistent with
// the advice, and irrigations show up as a sawtooth in the moisture curve.
function makeField(field, weather, todayIdx, scn, seed) {
  const crop = CROPS[field.crop];
  const soil = SOILS[field.soil];
  const sowIdx = dayNum(field.sowDate) - dayNum(weather[0].date);
  const firstIdx = clamp(sowIdx, 0, todayIdx);
  const stageAt = (i) => calc.cropStage(crop, i - sowIdx);
  const r = rng(`${seed}/${field.id}`);

  const today = stageAt(todayIdx);
  const tawToday = calc.totalAvailableWater(soil, today.rootDepth);
  const rawToday = calc.readilyAvailableWater(tawToday, crop.p);
  const dryness = scn.dryness[field.crop] ?? 0.5;

  const deficit = new Array(todayIdx + 1).fill(null);
  deficit[todayIdx] = Math.min(dryness * rawToday, tawToday * 0.95);
  const irrigations = [];

  for (let i = todayIdx - 1; i >= firstIdx; i--) {
    const st = stageAt(i);
    const taw = calc.totalAvailableWater(soil, st.rootDepth);
    const raw = calc.readilyAvailableWater(taw, crop.p);
    const w = weather[i];
    const rain = calc.effectiveRain(w.rain);
    // forwards:  D[i+1] = D[i] + Kc·ET0 − P_eff − I
    let before = deficit[i + 1] - st.kc * w.et0 + rain;
    if (before < 0 && crop.irrigated && rain === 0) {
      const dose = Math.round(clamp(raw * (0.8 + 0.2 * r()), 10, 30));
      irrigations.push({ date: w.date, mm: dose });
      before += dose;
    }
    deficit[i] = clamp(before, 0, taw * 0.85);
  }

  const readings = [];
  for (let i = firstIdx; i <= todayIdx; i++) {
    const st = stageAt(i);
    const jitter = i === todayIdx ? 0 : gauss(r) * 0.0015;
    readings.push({
      date: weather[i].date,
      theta: round(calc.thetaFromDeficit(deficit[i], soil, st.rootDepth) + jitter, 4),
    });
  }
  return { readings, irrigations: irrigations.reverse() };
}

// --- Pond and buoy ---------------------------------------------------------

/** Oxygen saturation in fresh water, mg/L, for a water temperature in °C. */
const oxygenSaturation = (t) => 14.62 - 0.3898 * t + 0.006969 * t * t - 0.00005897 * t * t * t;

function makePond(config, weather, todayIdx, scn, irrigationM3ByDay, now, demo) {
  const { pond, pump } = config;
  const full = calc.pondVolume(pond.depth, pond);
  const startNum = dayNum(weather[0].date);
  const todayStart = localMidnight(weather[todayIdx].date);
  const dayFraction = clamp((now - todayStart) / DAY_MS, 0, 1);

  // Daily fluxes in m³. Inflow is a base flow that fades over the summer plus runoff after rain.
  const flux = weather.slice(0, todayIdx + 1).map((w, i) => ({
    irrigation: irrigationM3ByDay[i] || 0,
    inflow: scn.inflowScale * (12 + 70 * Math.exp(-i / 35) + Math.max(0, w.rain - 5) * 14),
    rainMm: w.rain,
    et0Mm: w.et0,
  }));
  const weatherM3 = (i, volume) => {
    const area = calc.pondArea(calc.pondLevelFromVolume(volume, pond), pond);
    return ((flux[i].rainMm - calc.OPEN_WATER_FACTOR * flux[i].et0Mm) * area) / 1000;
  };

  // Volume at 00:00 each day, built backwards from the level the scenario wants right now.
  const volumeNow = calc.pondVolume(scn.level, pond);
  const v0 = new Array(todayIdx + 1);
  v0[todayIdx] = clamp(volumeNow - dayFraction * (weatherM3(todayIdx, volumeNow) + flux[todayIdx].inflow), 0, full);
  for (let i = todayIdx - 1; i >= 0; i--) {
    const next = v0[i + 1];
    v0[i] = clamp(next + flux[i].irrigation - flux[i].inflow - weatherM3(i, next), 0, full);
  }

  const volumeAt = (ts) => {
    const i = clamp(Math.floor((ts - localMidnight(weather[0].date)) / DAY_MS), 0, todayIdx);
    const frac = clamp((ts - localMidnight(weather[i].date)) / DAY_MS, 0, 1);
    const end = i < todayIdx ? v0[i + 1] : volumeNow;
    const pumpHours = flux[i].irrigation / pump.flowM3h;
    // The pump runs in the first hours after midnight; everything else is spread over the day.
    const pumped = pumpHours > 0 ? flux[i].irrigation * Math.min(1, (frac * 24) / Math.min(pumpHours, 24)) : 0;
    const span = i < todayIdx ? 1 : dayFraction || 1;
    const rest = end - v0[i] + flux[i].irrigation; // net of everything except the pump
    return clamp(v0[i] - pumped + rest * Math.min(1, frac / span), 0, full);
  };

  // Water temperature follows the air with a lag.
  const tw = [];
  weather.slice(0, todayIdx + 1).forEach((w, i) => {
    const target = (w.tMin + w.tMax) / 2 + 1.5;
    tw.push(i === 0 ? target : tw[i - 1] + 0.22 * (target - tw[i - 1]));
  });

  const reading = (ts) => {
    const i = clamp(Math.floor((ts - localMidnight(weather[0].date)) / DAY_MS), 0, todayIdx);
    const frac = clamp((ts - localMidnight(weather[i].date)) / DAY_MS, 0, 1);
    const hour = frac * 24;
    const base = i > 0 ? tw[i - 1] + (tw[i] - tw[i - 1]) * frac : tw[0];
    const temp = base + 0.8 * Math.sin((2 * Math.PI * (hour - 10)) / 24) + noise(ts, 1) * 0.05;
    // Oxygen peaks in the afternoon (photosynthesis) and bottoms out before dawn.
    const swing = 0.5 + 0.06 * Math.max(0, temp - 12);
    const oxygen = oxygenSaturation(temp) * scn.doFactor +
      swing * Math.sin((2 * Math.PI * (hour - 9)) / 24) + noise(ts, 2) * 0.08;
    const charge = Math.sin((2 * Math.PI * (hour - 11)) / 24);
    const batt = demo.lowBattery ? 14 + 4 * charge : 86 + 9 * charge;
    return {
      t: ts,
      lvl: round(calc.pondLevelFromVolume(volumeAt(ts), pond) + noise(ts, 3) * 0.002, 3),
      do: round(Math.max(0.2, oxygen), 2),
      temp: round(temp, 1),
      batt: Math.round(clamp(batt + noise(ts, 4), 1, 100)),
    };
  };

  // The buoy reports every 15 minutes. When it is silent the last reading is hours old.
  const QUARTER = 15 * 60000;
  const lastTs = demo.silent ? Math.floor((now - 190 * 60000) / QUARTER) * QUARTER : Math.floor(now / QUARTER) * QUARTER;
  const sample = (from, step) => {
    const out = [];
    for (let ts = Math.ceil(from / step) * step; ts <= lastTs; ts += step) out.push(reading(ts));
    return out;
  };
  const seasonStart = localMidnight(weather[0].date);
  const season = [];
  for (let i = 0; i <= todayIdx; i++) {
    const ts = localMidnight(isoFromDayNum(startNum + i)) + 12 * 3600000;
    if (ts <= lastTs) season.push(reading(ts));
  }
  const latest = reading(lastTs);
  season.push(latest);

  return {
    latest,
    // Level at 00:00 per day: what a daily roll-up of the buoy data would give.
    daily: v0.map((v, i) => ({ date: weather[i].date, level: round(calc.pondLevelFromVolume(v, pond), 4) })),
    series: {
      day: sample(lastTs - DAY_MS, QUARTER),
      week: sample(lastTs - 7 * DAY_MS, 3600000),
      season: season.filter((p) => p.t >= seasonStart),
    },
  };
}

// --- Prices ----------------------------------------------------------------

function makePrices(seed, todayNum) {
  const out = {};
  for (const [id, crop] of Object.entries(CROPS)) {
    const r = rng(`${seed}/price/${id}`);
    const phase = r() * Math.PI * 2;
    let walk = 0;
    const raw = [];
    for (let w = 0; w < 53; w++) {
      walk = 0.92 * walk + gauss(r) * 0.014;
      raw.push(1 + 0.05 * Math.sin((2 * Math.PI * w) / 52 + phase) + walk);
    }
    const scale = crop.priceKrT / raw[raw.length - 1];
    const step = crop.priceKrT >= 1000 ? 10 : 1;
    const history = raw.map((x, w) => ({
      date: isoFromDayNum(todayNum - (52 - w) * 7),
      price: Math.round((x * scale) / step) * step,
    }));
    out[id] = { current: history[history.length - 1].price, history };
  }
  return out;
}

// --- Everything together ---------------------------------------------------

/**
 * @param config  the farm (see DEFAULT_CONFIG)
 * @param demo    { scenario, silent, lowBattery }
 * @param today   ISO date the simulation plays on
 * @param now     timestamp within that day
 */
export function simulate(config, demo, today, now) {
  const scn = SCENARIOS[demo.scenario] || SCENARIOS.torr;
  const seed = `${config.farm.id}/${demo.scenario}`;
  const startNum = dayNum(SEASON_START);
  const todayNum = dayNum(today);
  const todayIdx = todayNum - startNum;

  const weather = makeWeather(scn, startNum, todayNum, seed);

  const soil = {};
  const irrigationLog = [];
  const irrigationM3ByDay = new Array(todayIdx + 1).fill(0);
  for (const field of config.fields) {
    const f = makeField(field, weather, todayIdx, scn, seed);
    soil[field.id] = { sensorId: field.sensorId, readings: f.readings };
    for (const irr of f.irrigations) {
      const volumeM3 = calc.irrigationVolume(irr.mm, field.areaHa);
      irrigationLog.push({ date: irr.date, fieldId: field.id, mm: irr.mm, volumeM3, source: 'sim' });
      irrigationM3ByDay[dayNum(irr.date) - startNum] += volumeM3;
    }
  }
  irrigationLog.sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    today,
    todayIdx,
    weather,
    soil,
    irrigationLog,
    pond: makePond(config, weather, todayIdx, scn, irrigationM3ByDay, now, demo),
    prices: makePrices(config.farm.id, todayNum),
  };
}
