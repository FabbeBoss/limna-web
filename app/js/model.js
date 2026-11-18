// Turns raw readings into what the farmer sees.
//
// buildSnapshot() is the seam towards the backend: today it gets its readings
// from the simulator, later the same snapshot is what GET /api/farms/:id/snapshot
// returns. The views only ever read a snapshot. All numbers come from calc.js.

import * as calc from './calc.js';
import { CROPS, SOILS, STAGE_NAMES } from './crops.js';
import { simulate } from './sim.js';
import { FORECAST_DAYS } from './defaults.js';
import {
  DAY_MS, addDays, localMidnight, clamp, fmt0, fmt1, fmt2, relDay, relNight,
  clockAfter, capitalize, listAnd,
} from './util.js';

const PUMP_START_HOUR = 22;
const HARD_WIND_MS = 8;
const WARM_WATER_C = 22;

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => (xs.length ? sum(xs) / xs.length : 0);
const worst = (...statuses) => (statuses.includes('bad') ? 'bad' : statuses.includes('warn') ? 'warn' : 'ok');
const pct = (theta) => fmt1(theta * 100);

/**
 * @param config   the farm
 * @param userLog  irrigations the farmer has ticked off: [{ key, fieldId, date, mm, volumeM3, ts }]
 * @param demo     { scenario, silent, lowBattery }
 * @param today    ISO date
 * @param now      timestamp
 */
export function buildSnapshot(config, userLog, demo, today, now) {
  const sim = simulate(config, demo, today, now);
  const { weather, todayIdx } = sim;
  const forecast = weather.slice(todayIdx, todayIdx + FORECAST_DAYS);
  const pond = buildPond(config, sim, userLog, today, now);
  const fields = config.fields.map((f) => buildField(f, config, sim, forecast, userLog, today));
  const plan = buildPlan(fields, config, pond, forecast, userLog, today);
  for (const f of fields) f.advice = fieldAdvice(f, plan, forecast, today);
  const economy = buildEconomy(fields, plan, config, sim);
  const alarms = buildAlarms(config, pond, fields, now);

  const status = worst(pond.status, ...fields.map((f) => f.status), ...alarms.map((a) => a.severity));
  return {
    today,
    now,
    farm: config.farm,
    config,
    simulated: true,
    status,
    headline: buildHeadline(plan, fields, alarms, pond, today),
    pond,
    fields,
    plan,
    economy,
    alarms,
    weather: { today: forecast[0], forecast },
  };
}

// --- Pond ------------------------------------------------------------------

function buildPond(config, sim, userLog, today, now) {
  const { pond, thresholds: th } = config;
  const { weather, todayIdx } = sim;
  const latest = sim.pond.latest;
  const ageMin = (now - latest.t) / 60000;
  const silent = ageMin > th.silentMin;

  // Water the farmer has ticked off since the last reading is taken off the measured volume.
  const tickedM3 = sum(userLog.map((e) => e.volumeM3));
  const volume = Math.max(0, calc.pondVolume(latest.lvl, pond) - tickedM3);
  const level = tickedM3 > 0 ? calc.pondLevelFromVolume(volume, pond) : latest.lvl;
  const fullVolume = calc.pondVolume(pond.depth, pond);
  const usable = calc.usableVolume(level, pond);
  const capacity = calc.usableCapacity(pond);

  // Water balance from the daily levels, the weather and the irrigation log.
  const loggedByDate = new Map();
  for (const e of [...sim.irrigationLog, ...userLog]) {
    loggedByDate.set(e.date, (loggedByDate.get(e.date) || 0) + e.volumeM3);
  }
  const daily = sim.pond.daily.map((d, i) => ({
    date: d.date,
    level: d.level,
    rainMm: weather[i].rain,
    et0Mm: weather[i].et0,
    irrigationM3: loggedByDate.get(d.date) || 0,
  }));
  const dayFraction = clamp((now - localMidnight(today)) / DAY_MS, 0, 1);
  const todayRow = { ...daily[todayIdx], rainMm: daily[todayIdx].rainMm * dayFraction, et0Mm: daily[todayIdx].et0Mm * dayFraction };
  const closing = { level };
  const addUp = (a, b) => ({
    usedM3: a.usedM3 + b.usedM3,
    inflowM3: a.inflowM3 + b.inflowM3,
    rainM3: a.rainM3 + b.rainM3,
    evapM3: a.evapM3 + b.evapM3,
    changeM3: a.changeM3 + b.changeM3,
  });
  const soFarToday = calc.waterBalance([todayRow, closing], pond);
  const lastWeek = calc.waterBalance(daily.slice(Math.max(0, todayIdx - 7), todayIdx + 1), pond);
  const season = calc.waterBalance(daily, pond);

  const withdrawals = lastWeek.rows.map((r) => r.netWithdrawalM3);
  const avgWithdrawal = mean(withdrawals);
  const daysLeft = calc.daysLeft(usable, withdrawals);
  const emptyDate = Number.isFinite(daysLeft) ? addDays(today, Math.floor(daysLeft)) : null;

  let status = 'ok';
  if (usable / capacity < 0.15 || daysLeft < th.pondDaysCritical || level < pond.hMin + th.levelMarginM) status = 'bad';
  else if (daysLeft < th.pondDaysWarn || usable / capacity < 0.3) status = 'warn';

  const withVolume = (points) => points.map((p) => ({ ...p, vol: calc.pondVolume(p.lvl, pond) }));
  const series = {
    day: withVolume(sim.pond.series.day),
    week: withVolume(sim.pond.series.week),
    season: withVolume(sim.pond.series.season),
  };
  if (tickedM3 > 0) {
    // Show the ticked-off water at once, before the next buoy reading confirms it.
    const point = { ...latest, t: now, lvl: level, vol: volume };
    for (const key of Object.keys(series)) series[key].push(point);
  }

  const dayMinDo = Math.min(...series.day.map((p) => p.do));
  return {
    name: pond.name,
    buoyId: pond.buoyId,
    latest: { ...latest, ageMin, silent },
    level,
    volume,
    fullVolume,
    fillShare: volume / fullVolume,
    usable,
    capacity,
    usableShare: capacity > 0 ? usable / capacity : 0,
    area: calc.pondArea(level, pond),
    hMin: pond.hMin,
    depth: pond.depth,
    tickedM3,
    avgWithdrawal,
    daysLeft,
    emptyDate,
    status,
    balance: { week: addUp(lastWeek, soFarToday), season: addUp(season, soFarToday) },
    series,
    quality: waterQuality(latest, dayMinDo, th),
    metrics: pondMetrics(latest, level, volume, fullVolume, pond, th),
  };
}

function pondMetrics(latest, level, volume, fullVolume, pond, th) {
  const low = pond.hMin + th.levelMarginM;
  return [
    {
      key: 'lvl', label: 'Vattennivå', value: fmt2(level), unit: 'm',
      normal: `Normalt ${fmt1(low)}–${fmt1(pond.depth)} m`,
      status: level < low ? 'bad' : level < low + 0.4 ? 'warn' : 'ok',
    },
    {
      key: 'vol', label: 'Volym', value: fmt0(Math.round(volume / 10) * 10), unit: 'm³',
      normal: `${fmt0((volume / fullVolume) * 100)} % av full damm`,
      status: 'none',
    },
    {
      key: 'do', label: 'Löst syre', value: fmt1(latest.do), unit: 'mg/L',
      normal: `Normalt över ${fmt0(th.doLow)} mg/L`,
      status: latest.do < th.doCritical ? 'bad' : latest.do < th.doLow ? 'warn' : 'ok',
    },
    {
      key: 'temp', label: 'Temperatur', value: fmt1(latest.temp), unit: '°C',
      normal: `Normalt under ${WARM_WATER_C} °C`,
      status: latest.temp >= WARM_WATER_C ? 'warn' : 'ok',
    },
    { key: 'ph', label: 'pH', pending: true },
    { key: 'turb', label: 'Grumlighet', pending: true },
  ];
}

function waterQuality(latest, dayMinDo, th) {
  const out = [];
  if (latest.do < th.doCritical) {
    out.push({
      status: 'bad', title: 'Mycket lågt syre',
      text: `${fmt1(latest.do)} mg/L. Vattnet kan vara syrefritt vid botten och lukta illa. Kontrollera dammen innan du bevattnar, särskilt grönsaker.`,
    });
  } else if (latest.do < th.doLow) {
    out.push({
      status: 'warn', title: 'Lågt syre',
      text: `${fmt1(latest.do)} mg/L. Risk för algblomning. Kontrollera vattnet innan du bevattnar grönsaker.`,
    });
  } else if (dayMinDo < th.doLow) {
    out.push({
      status: 'warn', title: 'Syret sjönk i natt',
      text: `Lägst ${fmt1(dayMinDo)} mg/L det senaste dygnet, nu ${fmt1(latest.do)} mg/L. Ett tecken på mycket alger i vattnet.`,
    });
  } else {
    out.push({ status: 'ok', title: 'Syrehalten är god', text: `${fmt1(latest.do)} mg/L. Vattnet går bra att bevattna med.` });
  }
  if (latest.temp >= WARM_WATER_C) {
    out.push({
      status: 'warn', title: 'Varmt vatten',
      text: `${fmt1(latest.temp)} °C. Varmt vatten håller mindre syre och gynnar alger.`,
    });
  }
  return out;
}

// --- Fields ----------------------------------------------------------------

function buildField(field, config, sim, forecast, userLog, today) {
  const crop = CROPS[field.crop];
  const soil = SOILS[field.soil];
  const { pump, prices } = config;
  const daysSinceSowing = Math.round((localMidnight(today) - localMidnight(field.sowDate)) / DAY_MS);
  const stage = calc.cropStage(crop, daysSinceSowing);
  const taw = calc.totalAvailableWater(soil, stage.rootDepth);
  const raw = calc.readilyAvailableWater(taw, crop.p);

  const readings = sim.soil[field.id].readings;
  const measuredTheta = readings[readings.length - 1].theta;
  // Irrigation ticked off since the reading counts straight away.
  const tickedMm = sum(userLog.filter((e) => e.fieldId === field.id).map((e) => e.mm));
  const deficit = Math.max(0, calc.soilDeficit(measuredTheta, soil, stage.rootDepth) - tickedMm);
  const theta = tickedMm > 0 ? calc.thetaFromDeficit(deficit, soil, stage.rootDepth) : measuredTheta;

  const days = forecast.map((w, i) => ({
    kc: calc.cropStage(crop, daysSinceSowing + i).kc,
    et0: w.et0,
    rain: w.rain,
  }));
  const nightCapacityMm = (pump.flowM3h * pump.maxHoursPerNight) / (field.areaHa * calc.M3_PER_MM_HA);
  const maxDoseMm = Math.min(pump.maxDoseMm, nightCapacityMm);
  const schedule = calc.irrigationSchedule({ d0: deficit, taw, raw, days, maxDoseMm });
  // The same rule with the rain taken out shows whether it is the forecast that saves the field.
  const scheduleNoRain = calc.irrigationSchedule({ d0: deficit, taw, raw, days: days.map((d) => ({ ...d, rain: 0 })), maxDoseMm });

  const etcPerDay = mean(days.map((d) => d.kc * d.et0));
  const daysOk = calc.daysWithoutWater(deficit, raw, etcPerDay);

  const priceKrT = sim.prices[field.crop].current;
  const valueKr = calc.cropValue(field.areaHa, field.yieldTHa, priceKrT);
  const loss = (deficits) =>
    calc.yieldLossKr({
      valueKr,
      ky: crop.ky,
      shortfallMm: calc.evapotranspiration(deficits, days, taw, raw).shortfall,
      seasonEtcMm: crop.seasonEtc,
    });
  const riskKr = loss(schedule.withoutIrrigation);
  const savedKr = Math.max(0, riskKr - loss(schedule.withIrrigation));
  const wantedM3 = sum(schedule.events.map((e) => calc.irrigationVolume(e.doseMm, field.areaHa)));
  const valuePerM3 = wantedM3 > 0 ? savedKr / wantedM3 : 0;

  let status = 'ok';
  if (deficit >= raw) status = 'bad';
  else if (schedule.events.some((e) => e.night === 0) || schedule.holds.some((h) => h.night === 0) || deficit >= 0.8 * raw) status = 'warn';

  const toTheta = (d) => calc.thetaFromDeficit(d, soil, stage.rootDepth);
  const history = readings.slice(-21).map((r) => ({ date: r.date, theta: r.theta }));
  history[history.length - 1] = { date: today, theta };

  return {
    id: field.id,
    name: field.name,
    areaHa: field.areaHa,
    cropId: field.crop,
    cropName: crop.name,
    soilName: soil.name,
    sowDate: field.sowDate,
    sensorId: field.sensorId,
    stage: { name: STAGE_NAMES[stage.index], index: stage.index, day: stage.day, seasonDays: stage.seasonDays },
    kc: stage.kc,
    rootDepth: stage.rootDepth,
    theta,
    thetaFc: soil.fc,
    thetaWp: soil.wp,
    thetaDry: toTheta(raw),   // the moisture where the crop starts to suffer
    taw,
    raw,
    deficit,
    etcPerDay,
    daysOk,
    status,
    statusText: status === 'bad' ? 'Torrt' : status === 'warn' ? 'Snart torrt' : 'Bra',
    // 0 = wilting point, 1 = field capacity
    fill: clamp(1 - deficit / taw, 0, 1),
    dryMark: clamp(1 - raw / taw, 0, 1),
    history,
    projection: {
      dates: schedule.withoutIrrigation.map((_, i) => addDays(today, i)),
      without: schedule.withoutIrrigation.map(toTheta),
      withPlan: schedule.withIrrigation.map(toTheta),
    },
    schedule,
    rainSaves: scheduleNoRain.events.some((e) => e.night <= 1) && !schedule.events.some((e) => e.night <= 1),
    days,
    priceKrT,
    yieldTHa: field.yieldTHa,
    valueKr,
    riskKr,
    savedKr,
    wantedM3,
    valuePerM3,
  };
}

// --- Irrigation plan -------------------------------------------------------

function buildPlan(fields, config, pond, forecast, userLog, today) {
  const { pump, prices } = config;
  const requests = [];
  for (const f of fields) {
    for (const e of f.schedule.events) {
      requests.push({
        key: `${f.id}:${addDays(today, e.night)}`,
        fieldId: f.id,
        night: e.night,
        doseMm: e.doseMm,
        deficitMm: e.deficitMm,
        volumeM3: calc.irrigationVolume(e.doseMm, f.areaHa),
        valuePerM3: f.valuePerM3,
      });
    }
  }
  const { grants, remainingM3 } = calc.allocateWater(requests, {
    usableM3: pond.usable,
    flowM3h: pump.flowM3h,
    maxHoursPerNight: pump.maxHoursPerNight,
  });

  const byId = new Map(fields.map((f) => [f.id, f]));
  const nights = [];
  for (let n = 0; n < FORECAST_DAYS; n++) {
    const passes = grants
      .filter((g) => g.night === n && g.grantedM3 > 0.5)
      .sort((a, b) => b.valuePerM3 - a.valuePerM3)
      .map((g) => {
        const f = byId.get(g.fieldId);
        const hours = g.grantedM3 / pump.flowM3h;
        return {
          key: g.key,
          fieldId: f.id,
          fieldName: f.name,
          cropName: f.cropName,
          mm: g.grantedM3 / (f.areaHa * calc.M3_PER_MM_HA),
          wantedMm: g.doseMm,
          volumeM3: g.grantedM3,
          hours,
          limit: g.limit,
          costKr: calc.irrigationCost({
            hours, powerKw: pump.powerKw, elPriceKrKwh: prices.elKrKwh,
            volumeM3: g.grantedM3, waterFeeKrM3: prices.waterFeeKrM3,
          }),
        };
      });
    let hour = 0;
    for (const p of passes) {
      p.start = clockAfter(PUMP_START_HOUR, hour);
      hour += p.hours;
      p.end = clockAfter(PUMP_START_HOUR, hour);
    }
    const wind = Math.max(forecast[n].wind, forecast[n + 1]?.wind ?? 0);
    nights.push({
      night: n,
      date: addDays(today, n),
      label: capitalize(relNight(today, n)),
      passes,
      totalHours: hour,
      totalM3: sum(passes.map((p) => p.volumeM3)),
      wind,
      windy: passes.length > 0 && wind > HARD_WIND_MS,
    });
  }

  // What could not be served, and why.
  const shortfalls = grants
    .filter((g) => g.limit)
    .map((g) => ({
      fieldId: g.fieldId,
      fieldName: byId.get(g.fieldId).name,
      night: g.night,
      limit: g.limit,
      missingM3: g.volumeM3 - g.grantedM3,
      nothing: g.grantedM3 <= 0.5,
    }));

  const ranking = fields
    .filter((f) => f.wantedM3 > 0)
    .map((f) => {
      const granted = sum(grants.filter((g) => g.fieldId === f.id).map((g) => g.grantedM3));
      return { fieldId: f.id, name: f.name, cropName: f.cropName, valuePerM3: f.valuePerM3, wantedM3: f.wantedM3, grantedM3: granted };
    })
    .sort((a, b) => b.valuePerM3 - a.valuePerM3);

  const totalM3 = sum(nights.map((n) => n.totalM3));
  return {
    nights,
    tonight: nights[0],
    grants,
    shortfalls,
    waterShort: shortfalls.some((s) => s.limit === 'water'),
    ranking,
    totalM3,
    wantedM3: sum(requests.map((r) => r.volumeM3)),
    usableNowM3: pond.usable,
    usableAfterM3: remainingM3,
    usableAfterTonightM3: pond.usable - nights[0].totalM3,
    done: userLog.map((e) => ({ ...e, fieldName: byId.get(e.fieldId)?.name ?? 'Borttaget fält' })),
  };
}

/** The advice for one field, with the sentence that explains it. */
function fieldAdvice(f, plan, forecast, today) {
  const tonight = plan.tonight.passes.find((p) => p.fieldId === f.id);
  const dueTonight = f.schedule.events.find((e) => e.night === 0);
  const hold = f.schedule.holds.find((h) => h.night === 0);
  const next = plan.nights.find((n) => n.night > 0 && n.passes.some((p) => p.fieldId === f.id));
  let dryDays = 0;
  while (dryDays < forecast.length && forecast[dryDays].rain <= calc.EFFECTIVE_RAIN_MIN_MM) dryDays++;
  const noRain = dryDays >= forecast.length
    ? 'Inget regn att räkna med den närmaste veckan.'
    : `Inget regn att räkna med på ${dryDays} dygn.`;
  const drying = `${f.cropName.split(' ')[0]} drar nu ${fmt1(f.etcPerDay)} mm per dygn.`;

  if (tonight) {
    const why = f.deficit >= f.raw
      ? `Jorden är torr: markfukten är ${pct(f.theta)} % och gränsen går vid ${pct(f.thetaDry)} %.`
      : `Jorden når torrgränsen ${f.daysOk < 1 ? 'inom ett dygn' : 'i morgon'}. ${drying}`;
    const noRainShort = dryDays >= forecast.length ? 'inget regn i sikte' : `inget regn på ${dryDays} dygn`;
    return {
      kind: 'tonight',
      title: `Vattna i natt, ${fmt0(tonight.mm)} mm`,
      short: `${f.deficit >= f.raw ? 'Torr jord' : f.daysOk < 1 ? 'Torrt inom ett dygn' : 'Torrt i morgon'}, ${noRainShort}`,
      reason: `${why} ${noRain}`,
      pass: tonight,
    };
  }
  if (dueTonight) {
    return {
      kind: 'short',
      title: 'Vattnet räcker inte',
      reason: 'Fältet behöver vatten, men det som finns i dammen gör mer nytta per kubikmeter på andra fält.',
    };
  }
  if (hold) {
    return {
      kind: 'hold',
      title: 'Vänta, regn på väg',
      reason: `Jorden börjar bli torr, men ${fmt0(hold.rainMm)} mm regn väntas ${relDay(today, hold.rainDay)}. Vänta och se vad som kommer.`,
    };
  }
  if (next) {
    const p = next.passes.find((x) => x.fieldId === f.id);
    return {
      kind: 'planned',
      title: `Planera ${fmt0(p.mm)} mm ${relNight(today, next.night)}`,
      reason: `Markfukten räcker ${Math.floor(f.daysOk) <= 1 ? 'ett dygn' : `${Math.floor(f.daysOk)} dygn`} till. ${drying}`,
      pass: p,
      night: next.night,
    };
  }
  if (f.rainSaves) {
    const i = forecast.findIndex((w) => w.rain > calc.EFFECTIVE_RAIN_MIN_MM);
    return {
      kind: 'none',
      title: 'Ingen bevattning behövs',
      reason: `${fmt0(forecast[i].rain)} mm regn väntas ${relDay(today, i)}. Det räcker för att hålla jorden fuktig.`,
    };
  }
  const days = Math.floor(f.daysOk);
  return {
    kind: 'none',
    title: 'Ingen bevattning behövs',
    reason: days > 14
      ? 'Det finns gott om vatten i jorden, mer än två veckors förbrukning.'
      : `Det finns vatten i jorden för ungefär ${days} dygn till.`,
  };
}

// --- Money -----------------------------------------------------------------

function buildEconomy(fields, plan, config, sim) {
  const { pump, prices } = config;
  const perField = fields.map((f) => {
    const passes = plan.nights.flatMap((n) => n.passes.filter((p) => p.fieldId === f.id));
    const grantedM3 = sum(passes.map((p) => p.volumeM3));
    const costKr = sum(passes.map((p) => p.costKr));
    const savedKr = f.wantedM3 > 0 ? f.savedKr * (grantedM3 / f.wantedM3) : 0;
    return {
      fieldId: f.id,
      name: f.name,
      cropName: f.cropName,
      areaHa: f.areaHa,
      yieldTHa: f.yieldTHa,
      priceKrT: f.priceKrT,
      valueKr: f.valueKr,
      riskKr: f.riskKr,
      savedKr,
      costKr,
      plannedMm: sum(passes.map((p) => p.mm)),
      plannedM3: grantedM3,
      returnPerKr: costKr > 0 ? savedKr / costKr : null,
      costPerMmKr: calc.costPerMm(f.areaHa, pump, prices.elKrKwh, prices.waterFeeKrM3),
      valuePerM3: f.valuePerM3,
    };
  });
  const cropIds = [...new Set(fields.map((f) => f.cropId))];
  return {
    perField,
    totalValueKr: sum(perField.map((f) => f.valueKr)),
    totalRiskKr: sum(perField.map((f) => f.riskKr)),
    totalSavedKr: sum(perField.map((f) => f.savedKr)),
    totalCostKr: sum(perField.map((f) => f.costKr)),
    prices: cropIds.map((id) => ({ cropId: id, cropName: CROPS[id].name, ...sim.prices[id] })),
    horizonDays: FORECAST_DAYS,
  };
}

// --- Alarms ----------------------------------------------------------------

function buildAlarms(config, pond, fields, now) {
  const th = config.thresholds;
  const out = [];
  const { latest } = pond;
  if (latest.silent) {
    out.push({
      id: 'silent', severity: 'warn', title: 'Bojen är tyst',
      text: `Ingen mätning på ${fmt0(latest.ageMin / 60)} timmar. Appen visar senast kända värden.`,
      href: '#/damm',
    });
  }
  if (latest.do < th.doLow) {
    out.push({
      id: 'do', severity: latest.do < th.doCritical ? 'bad' : 'warn', title: 'Lågt syre i dammen',
      text: `${fmt1(latest.do)} mg/L, gränsen är ${fmt0(th.doLow)} mg/L.`,
      href: '#/damm',
    });
  }
  if (pond.status === 'bad') {
    out.push({
      id: 'level', severity: 'bad', title: 'Låg vattennivå',
      text: Number.isFinite(pond.daysLeft)
        ? `Vattnet räcker ungefär ${fmt0(Math.floor(pond.daysLeft))} dygn med nuvarande uttag.`
        : `Nivån är ${fmt1(pond.level)} m, nära pumpens lägsta nivå.`,
      href: '#/damm',
    });
  }
  for (const f of fields.filter((x) => x.status === 'bad')) {
    out.push({
      id: `dry-${f.id}`, severity: 'warn', title: `Torrt fält: ${f.name}`,
      text: `Markfukt ${pct(f.theta)} %, gränsen för ${f.cropName.split(' ')[0].toLowerCase()} går vid ${pct(f.thetaDry)} %.`,
      href: `#/aker/${f.id}`,
    });
  }
  if (latest.batt < th.battLow) {
    out.push({
      id: 'batt', severity: 'warn', title: 'Lågt batteri i bojen',
      text: `${fmt0(latest.batt)} %. Kontrollera solpanelen.`,
      href: '#/damm',
    });
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'bad' ? -1 : 1));
}

// --- The five-second answer ------------------------------------------------

function buildHeadline(plan, fields, alarms, pond, today) {
  const tonight = plan.tonight.passes;
  const holds = fields.filter((f) => f.advice.kind === 'hold');
  const short = fields.filter((f) => f.advice.kind === 'short');
  const planned = fields.filter((f) => f.advice.kind === 'planned').sort((a, b) => a.advice.night - b.advice.night);

  if (tonight.length) {
    const names = tonight.map((p) => p.fieldName);
    return {
      status: short.length || pond.status === 'bad' ? 'bad' : 'warn',
      title: `Vattna ${listAnd(names)} i natt`,
      text: short.length
        ? `Vattnet räcker inte till ${listAnd(short.map((f) => f.name))}.`
        : `${fmt0(plan.tonight.totalM3)} m³ ur dammen. Pumpen går ungefär ${fmt0(Math.ceil(plan.tonight.totalHours))} timmar.`,
    };
  }
  if (short.length) {
    return { status: 'bad', title: 'Vattnet i dammen räcker inte', text: `${listAnd(short.map((f) => f.name))} behöver vatten.` };
  }
  if (holds.length) {
    const h = holds[0].schedule.holds[0];
    return {
      status: 'ok',
      title: 'Ingen bevattning i natt, regn väntas',
      text: `${fmt0(h.rainMm)} mm ${relDay(today, h.rainDay)}. Vänta och se vad som kommer.`,
    };
  }
  if (planned.length) {
    const f = planned[0];
    return {
      status: 'ok',
      title: 'Ingen bevattning i natt',
      text: `Nästa blir ${f.name}, ${relNight(today, f.advice.night)}.`,
    };
  }
  return {
    status: 'ok',
    title: 'Ingen bevattning behövs',
    text: pond.status === 'ok' ? 'Jorden är fuktig och dammen har gott om vatten.' : 'Jorden är fuktig den närmaste veckan.',
  };
}
