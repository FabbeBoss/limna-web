// The screens. Each function takes a snapshot (see model.js) and returns HTML.
// Nothing is calculated here: the views only choose words and layout.

import { CROPS, SOILS } from './crops.js';
import { SCENARIOS } from './defaults.js';
import { icon, weatherIcon } from './icons.js';
import { chartSlot } from './charts.js';
import { farmMap } from './map.js';
import {
  DAY_MS, localMidnight, fmt0, fmt1, fmt2, fmtKr, fmtM3, fmtHours, weekdayShort,
  dateShort, dateLong, relNight, clock, ago, escapeHtml as esc,
} from './util.js';

const INK = '#1c3d38';
const TEAL = '#17675d';
const BLUE = '#2a62b5';
const ORANGE = '#b86e00';

const STATUS_WORD = { ok: 'Bra', warn: 'Håll koll', bad: 'Åtgärd krävs' };

// --- Small building blocks -------------------------------------------------

const pill = (status, text) =>
  `<span class="pill pill--${status}">${icon(status)}<span>${esc(text ?? STATUS_WORD[status])}</span></span>`;

const seg = (key, current, options) =>
  `<div class="seg" role="group">${options
    .map(([value, label]) => `<button type="button" class="seg__btn" data-action="ui" data-key="${key}" data-value="${value}" aria-pressed="${value === current}">${label}</button>`)
    .join('')}</div>`;

const pct1 = (theta) => fmt1(theta * 100);

function moistureBar(f) {
  return `<div class="mbar mbar--${f.status}" role="img" aria-label="Markfukt ${pct1(f.theta)} procent, torrgräns ${pct1(f.thetaDry)} procent">
    <div class="mbar__fill" style="width:${(f.fill * 100).toFixed(1)}%"></div>
    <div class="mbar__mark" style="left:${(f.dryMark * 100).toFixed(1)}%"></div>
  </div>`;
}

function daysOkText(f) {
  const d = Math.floor(f.daysOk);
  if (f.daysOk <= 0) return 'Behöver vatten nu';
  if (d < 1) return 'Klarar sig mindre än ett dygn';
  if (d > 14) return 'Klarar sig mer än två veckor';
  return `Klarar sig ungefär ${d} dygn`;
}

function pondDaysText(p) {
  if (!Number.isFinite(p.daysLeft)) return 'Dammen sjunker inte just nu';
  if (p.daysLeft > 90) return 'Räcker mer än tre månader med nuvarande uttag';
  return `Räcker ungefär ${fmt0(Math.floor(p.daysLeft))} dygn med nuvarande uttag`;
}

function pondBar(p) {
  const dead = 1 - p.capacity / p.fullVolume;
  return `<div class="tank tank--${p.status}" role="img" aria-label="${fmt0(p.usableShare * 100)} procent av det användbara vattnet finns kvar">
    <div class="tank__dead" style="width:${(dead * 100).toFixed(1)}%"></div>
    <div class="tank__fill" style="width:${(Math.max(0, p.fillShare - dead) * 100).toFixed(1)}%"></div>
  </div>`;
}

const facts = (rows) =>
  `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

// --- Översikt --------------------------------------------------------------

export function overview(s) {
  const { pond: p, plan, economy: e, headline: h } = s;
  const tonight = plan.tonight.passes;
  const forecast = s.weather.forecast.slice(0, 5);

  const hero = `<section class="hero hero--${h.status}">
    <div class="hero__icon">${icon(h.status)}</div>
    <div class="hero__body">
      <p class="eyebrow">Dagens råd</p>
      <h1>${esc(h.title)}</h1>
      <p class="hero__text">${esc(h.text)}</p>
    </div>
    ${tonight.length ? `<ul class="hero__list">${tonight.map((t) => {
      const f = s.fields.find((x) => x.id === t.fieldId);
      return `<li>
        <div><b>${esc(t.fieldName)}</b><span>${esc(f.advice.short || '')}</span></div>
        <div class="hero__dose"><b>${fmt0(t.mm)} mm</b><span>${fmtHours(t.hours)}</span></div>
      </li>`;
    }).join('')}</ul>` : ''}
    <a class="btn btn--primary" href="#/plan">Visa bevattningsplanen ${icon('chevron')}</a>
  </section>`;

  const pondCard = `<a class="card card--link" href="#/damm">
    <header class="card__head"><h2>${icon('pond')}Dammen</h2>${pill(p.status)}</header>
    <p class="big">${fmtM3(p.usable)} <small>m³ användbart vatten</small></p>
    ${pondBar(p)}
    <p class="card__line"><b>${fmt0(p.usableShare * 100)} %</b> kvar. ${pondDaysText(p)}.</p>
  </a>`;

  const fieldsCard = `<section class="card">
    <header class="card__head"><h2>${icon('field')}Åkern</h2>${fieldsPill(s.fields)}</header>
    <ul class="rows">${s.fields.map((f) => `<li><a class="row" href="#/aker/${f.id}">
      <div class="row__main">
        <div class="row__title"><b>${esc(f.name)}</b><span>${esc(f.cropName)}</span></div>
        ${moistureBar(f)}
      </div>
      <div class="row__side"><b>${pct1(f.theta)} %</b>${pill(f.status, f.statusText)}</div>
    </a></li>`).join('')}</ul>
    <p class="hint">Strecket i stapeln visar torrgränsen. Under den börjar grödan ta skada.</p>
  </section>`;

  const weatherCard = `<section class="card">
    <header class="card__head"><h2>${icon('sun')}Väder, fem dygn</h2></header>
    <ol class="wx">${forecast.map((w, i) => `<li class="${w.rain >= 3 ? 'wx--rain' : ''}">
      <span class="wx__day">${i === 0 ? 'i dag' : weekdayShort(w.date)}</span>
      ${weatherIcon(w.rain)}
      <b>${fmt0(w.tMax)}°</b>
      <span class="wx__rain">${w.rain >= 0.5 ? `${fmt0(w.rain)} mm` : '–'}</span>
    </li>`).join('')}</ol>
  </section>`;

  const valueCard = `<a class="card card--link" href="#/ekonomi">
    <header class="card__head"><h2>${icon('money')}Grödornas värde</h2></header>
    <p class="big">${fmtKr(e.totalValueKr)}</p>
    <p class="card__line">${e.totalRiskKr >= 500
      ? `<b>${fmtKr(e.totalRiskKr)}</b> i riskzonen om inget vattnas på sju dygn.`
      : 'Inget värde i riskzonen den närmaste veckan.'}</p>
    <p class="hint">Uppskattning på areal, förväntad skörd och dagens pris.</p>
  </a>`;

  const statusCard = `<section class="card">
    <header class="card__head"><h2>${icon('bell')}Larm och status</h2>${s.alarms.length ? '' : pill('ok', 'Inga larm')}</header>
    ${s.alarms.length ? `<ul class="alarms">${s.alarms.map(alarmRow).join('')}</ul>` : ''}
    <ul class="statuslist">
      <li>${icon(p.latest.silent ? 'nosignal' : 'signal')}<span>Senaste mätning <b>${clock(p.latest.t)}</b>, ${ago(p.latest.ageMin)}</span></li>
      <li>${icon('battery')}<span>Bojens batteri <b>${fmt0(p.latest.batt)} %</b></span></li>
    </ul>
  </section>`;

  return `<div class="grid grid--overview">${hero}${pondCard}${fieldsCard}${weatherCard}${valueCard}${statusCard}</div>`;
}

function fieldsPill(fields) {
  const dry = fields.filter((f) => f.status === 'bad').length;
  const soon = fields.filter((f) => f.status === 'warn').length;
  if (dry) return pill('bad', dry === 1 ? '1 fält torrt' : `${dry} fält torra`);
  if (soon) return pill('warn', soon === 1 ? '1 fält snart torrt' : `${soon} fält snart torra`);
  return pill('ok', 'Fuktigt');
}

const alarmRow = (a) => `<li><a class="alarm alarm--${a.severity}" href="${a.href}">
  ${icon(a.severity)}<div><b>${esc(a.title)}</b><span>${esc(a.text)}</span></div>${icon('chevron', 'icon--end')}
</a></li>`;

// --- Dammen ----------------------------------------------------------------

function pondSection(p, cfg) {
  // The pond sits to the left; the right-hand gutter holds the labels.
  const W = 340;
  const top = 22;
  const bed = 136;
  const cx = 120;
  const halfTop = 114;
  // Widths go with the square root of the areas, as for a round pond.
  const halfBed = Math.max(40, halfTop * Math.sqrt(Math.min(1, cfg.a0 / cfg.aMax)));
  const yAt = (h) => bed - (Math.min(h, p.depth) / p.depth) * (bed - top);
  const halfAt = (h) => halfBed + (halfTop - halfBed) * (Math.min(h, p.depth) / p.depth);
  const poly = (h) => `${cx - halfAt(h)},${yAt(h)} ${cx + halfAt(h)},${yAt(h)} ${cx + halfBed},${bed} ${cx - halfBed},${bed}`;
  const yL = yAt(p.level);
  const yMin = yAt(p.hMin);
  const deep = bed - yL > 30;
  return `<svg class="pondsvg" viewBox="0 0 ${W} 146" role="img" aria-label="Dammen i genomskärning. Nivån är ${fmt2(p.level)} meter av ${fmt1(p.depth)}.">
    <polygon class="ps-bed" points="${poly(p.depth)}"/>
    <polygon class="ps-water" points="${poly(p.level)}"/>
    <polygon class="ps-dead" points="${poly(Math.min(p.level, p.hMin))}"/>
    <line class="ps-min" x1="${cx - halfAt(p.hMin) - 6}" x2="${W - 4}" y1="${yMin}" y2="${yMin}"/>
    <text class="ps-label" x="${W - 4}" y="${yMin - 6}" text-anchor="end">Pumpgräns ${fmt2(p.hMin)} m</text>
    <line class="ps-min" x1="${cx + halfTop + 4}" x2="${W - 4}" y1="${top}" y2="${top}"/>
    <text class="ps-label" x="${W - 4}" y="${top + 14}" text-anchor="end">Full ${fmt2(p.depth)} m</text>
    <line class="ps-mast" x1="${cx + 34}" x2="${cx + 34}" y1="${yL - 15}" y2="${yL - 3}"/>
    <circle class="ps-buoy" cx="${cx + 34}" cy="${yL}" r="5.500"/>
    <text class="${deep ? 'ps-now ps-now--in' : 'ps-now'}" x="${cx - 14}" y="${deep ? yL + 20 : yL - 9}" text-anchor="middle">${fmt2(p.level)} m</text>
  </svg>`;
}

function timeTicks(points, range) {
  if (!points.length) return [];
  const t0 = points[0].x;
  const t1 = points[points.length - 1].x;
  const ticks = [];
  if (range === 'day') {
    const start = new Date(t0);
    start.setMinutes(0, 0, 0);
    for (let t = start.getTime(); t <= t1; t += 3600000) {
      const h = new Date(t).getHours();
      if (t >= t0 && h % 6 === 0) ticks.push({ x: t, label: `${String(h).padStart(2, '0')}:00` });
    }
  } else {
    const d = new Date(t0);
    d.setHours(0, 0, 0, 0);
    for (let t = d.getTime(); t <= t1; t = new Date(t).setDate(new Date(t).getDate() + 1)) {
      const day = new Date(t);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      if (t < t0) continue;
      if (range === 'week') ticks.push({ x: t + DAY_MS / 2, label: weekdayShort(iso) });
      else if (range === 'season' && day.getDate() === 1) ticks.push({ x: t, label: dateShort(iso).split(' ')[1] });
      else if (range === 'field' && day.getDate() % 2 === 0) ticks.push({ x: t, label: dateShort(iso) });
      else if (range === 'year' && day.getDate() <= 7 && day.getMonth() % 2 === 0) ticks.push({ x: t, label: dateShort(iso).split(' ')[1] });
    }
  }
  return ticks;
}

const isoOf = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const stamp = (ts) => `${weekdayShort(isoOf(ts))} ${dateShort(isoOf(ts))} ${clock(ts)}`;

const POND_METRICS = {
  lvl: { label: 'Nivå', unit: 'm', digits: 2 },
  vol: { label: 'Volym', unit: 'm³', digits: 0 },
  do: { label: 'Syre', unit: 'mg/L', digits: 1 },
  temp: { label: 'Temperatur', unit: '°C', digits: 1 },
};

function pondChart(s, ui) {
  const p = s.pond;
  const th = s.config.thresholds;
  const metric = POND_METRICS[ui.pondMetric];
  const points = p.series[ui.pondRange].map((r) => ({ x: r.t, y: r[ui.pondMetric] }));
  const values = points.map((q) => q.y);
  const lo = Math.min(...values);
  const lines = [];
  if (ui.pondMetric === 'lvl' && (ui.pondRange === 'season' || lo < p.hMin + 0.5)) lines.push({ y: p.hMin, label: 'Lägsta pumpnivå' });
  if (ui.pondMetric === 'vol' && (ui.pondRange === 'season' || lo < (p.fullVolume - p.capacity) * 1.6)) lines.push({ y: p.fullVolume - p.capacity, label: 'Under pumpens nivå' });
  if (ui.pondMetric === 'do' && lo < th.doLow + 2.5) lines.push({ y: th.doLow, label: 'Larmgräns' });
  const rangeWord = { day: 'senaste dygnet', week: 'senaste veckan', season: 'under säsongen' }[ui.pondRange];
  return chartSlot('pond', {
    height: 230,
    unit: metric.unit,
    digits: metric.digits,
    label: `${metric.label} ${rangeWord}. Senaste värde ${values[values.length - 1]} ${metric.unit}.`,
    series: [{ name: metric.label, color: TEAL, area: ui.pondMetric === 'lvl' || ui.pondMetric === 'vol', points }],
    xTicks: timeTicks(points, ui.pondRange),
    xLabel: ui.pondRange === 'season' ? (x) => dateShort(isoOf(x)) : stamp,
    lines,
  });
}

function balanceBlock(b) {
  const rows = [
    ['Bevattning och annat uttag', -b.usedM3],
    ['Avdunstning', -b.evapM3],
    ['Tillrinning', b.inflowM3],
    ['Regn på dammen', b.rainM3],
  ];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r[1])));
  return `<ul class="balance">${rows.map(([label, v]) => `<li>
      <span class="balance__label">${label}</span>
      <span class="balance__bar"><i class="${v < 0 ? 'out' : 'in'}" style="width:${((Math.abs(v) / max) * 100).toFixed(1)}%"></i></span>
      <b>${v < 0 ? '−' : '+'}${fmtM3(Math.abs(v))} m³</b>
    </li>`).join('')}</ul>
    <p class="balance__net">Förändring i dammen: <b>${b.changeM3 < 0 ? '−' : '+'}${fmtM3(Math.abs(b.changeM3))} m³</b></p>`;
}

export function pond(s, ui) {
  const p = s.pond;
  const forecast = Number.isFinite(p.daysLeft) && p.daysLeft <= 90
    ? `Om uttaget fortsätter som nu når dammen pumpens lägsta nivå omkring <b>${dateLong(p.emptyDate)}</b>. Snittet den senaste veckan är ${fmtM3(p.avgWithdrawal)} m³ per dygn.`
    : p.avgWithdrawal > 0
      ? `Med nuvarande uttag, ${fmtM3(p.avgWithdrawal)} m³ per dygn, räcker vattnet säsongen ut.`
      : 'Dammen har inte sjunkit den senaste veckan.';

  return `<div class="grid grid--two">
    <section class="card card--span">
      <header class="card__head"><h1>${esc(p.name)}</h1>${pill(p.status)}</header>
      <div class="pondtop">
        <div>
          <p class="big">${fmtM3(p.usable)} <small>m³ användbart vatten</small></p>
          <p class="card__line"><b>${fmt0(p.usableShare * 100)} %</b> av det pumpen kan nå. ${pondDaysText(p)}.</p>
          <p class="card__line">${forecast}</p>
          ${p.tickedM3 > 0 ? `<p class="hint">${fmtM3(p.tickedM3)} m³ avbockad bevattning är avdragen från senaste mätningen.</p>` : ''}
        </div>
        ${pondSection(p, s.config.pond)}
      </div>
    </section>

    <section class="card card--span">
      <header class="card__head"><h2>Nyckeltal</h2><span class="muted">${clock(p.latest.t)}, ${ago(p.latest.ageMin)}</span></header>
      <div class="tiles">${p.metrics.map((m) => m.pending
        ? `<div class="tile tile--pending"><span class="tile__label">${m.label}</span><b class="tile__value">–</b><span class="tile__normal">Givaren kommer senare</span></div>`
        : `<div class="tile tile--${m.status}">
            <span class="tile__label">${m.label}${m.status === 'warn' || m.status === 'bad' ? icon(m.status) : ''}</span>
            <b class="tile__value">${m.value} <small>${m.unit}</small></b>
            <span class="tile__normal">${m.normal}</span>
          </div>`).join('')}</div>
    </section>

    <section class="card card--span">
      <header class="card__head card__head--wrap"><h2>Mätvärden över tid</h2>
        ${seg('pondRange', ui.pondRange, [['day', 'Dygn'], ['week', 'Vecka'], ['season', 'Säsong']])}</header>
      ${seg('pondMetric', ui.pondMetric, Object.entries(POND_METRICS).map(([k, m]) => [k, m.label]))}
      ${pondChart(s, ui)}
    </section>

    <section class="card">
      <header class="card__head card__head--wrap"><h2>Vattenbalans</h2>
        ${seg('balanceRange', ui.balanceRange, [['week', '7 dygn'], ['season', 'Säsong']])}</header>
      ${balanceBlock(p.balance[ui.balanceRange])}
      <p class="hint">Räknat ur nivåändringen, vädret och avbockade bevattningar. 1 mm på 1 ha är 10 m³.</p>
    </section>

    <section class="card">
      <header class="card__head"><h2>Vattenkvalitet</h2></header>
      <ul class="notes">${p.quality.map((q) => `<li class="note note--${q.status}">${icon(q.status)}<div><b>${esc(q.title)}</b><span>${esc(q.text)}</span></div></li>`).join('')}</ul>
      <header class="card__head card__head--sub"><h2>Bojen</h2></header>
      ${facts([
        ['Boj', esc(p.buoyId)],
        ['Senaste mätning', `${clock(p.latest.t)}, ${ago(p.latest.ageMin)}`],
        ['Batteri', `${fmt0(p.latest.batt)} %`],
      ])}
    </section>
  </div>`;
}

// --- Åkern -----------------------------------------------------------------

export function fields(s, ui) {
  return `<div class="pagehead"><h1>Åkern</h1>${fieldsPill(s.fields)}</div>
  ${s.fields.length ? farmMap(s, ui) : ''}
  <div class="pagehead pagehead--sub"><h2>Fält för fält</h2></div>
  <div class="grid grid--two">${s.fields.map((f) => `<a class="card card--link fieldcard" href="#/aker/${f.id}">
    <header class="card__head"><h2>${esc(f.name)}</h2>${pill(f.status, f.statusText)}</header>
    <p class="muted">${esc(f.cropName)}, ${f.stage.name.toLowerCase()} · ${fmt1(f.areaHa)} ha · ${esc(f.soilName.toLowerCase())}</p>
    <p class="big">${pct1(f.theta)} <small>% markfukt</small></p>
    ${moistureBar(f)}
    <div class="mbar__legend"><span>Vissnar ${pct1(f.thetaWp)} %</span><span>Torrgräns ${pct1(f.thetaDry)} %</span><span>Full ${pct1(f.thetaFc)} %</span></div>
    <p class="card__line"><b>${daysOkText(f)}</b> utan regn eller bevattning.</p>
    <p class="advice advice--${f.advice.kind}">${esc(f.advice.title)} ${icon('chevron', 'icon--end')}</p>
  </a>`).join('')}</div>
  ${s.fields.length ? '' : '<p class="muted">Inga fält är inlagda. Lägg till fält under Inställningar.</p>'}`;
}

function fieldChart(f, s) {
  const x = (iso) => localMidnight(iso);
  const pctPoints = (dates, thetas) => dates.map((d, i) => ({ x: x(d), y: thetas[i] * 100 }));
  const measured = f.history.map((h) => ({ x: x(h.date), y: h.theta * 100 }));
  const irrigated = s.plan.nights.some((n) => n.passes.some((p) => p.fieldId === f.id));
  const series = [{ name: 'Uppmätt', color: INK, points: measured }];
  if (irrigated) series.push({ name: 'Med bevattning enligt rådet', color: BLUE, points: pctPoints(f.projection.dates, f.projection.withPlan) });
  series.push({ name: irrigated ? 'Utan bevattning' : 'Prognos', color: ORANGE, dashed: true, points: pctPoints(f.projection.dates, f.projection.without) });
  const all = series.flatMap((q) => q.points);
  return chartSlot(`field-${f.id}`, {
    height: 250,
    unit: '%',
    digits: 1,
    label: `Markfukt i ${f.name} de senaste tre veckorna och prognos för sju dygn. Nu ${pct1(f.theta)} procent.`,
    series,
    xTicks: timeTicks(all.slice().sort((a, b) => a.x - b.x), 'field'),
    xLabel: (t) => `${weekdayShort(isoOf(t))} ${dateShort(isoOf(t))}`,
    vline: { x: x(s.today), label: 'i dag' },
    lines: [
      { y: f.thetaFc * 100, label: 'Fältkapacitet' },
      { y: f.thetaDry * 100, label: 'Torrgräns' },
      { y: f.thetaWp * 100, label: 'Vissningsgräns' },
    ],
  });
}

/** The numbers behind a field's advice, so every figure can be traced. */
function numbersBehind(f, s) {
  const { pump } = s.config;
  const rain7 = s.weather.forecast.reduce((a, w) => a + w.rain, 0);
  const pass = f.advice.pass;
  const rows = [
    ['Markfukt nu', `${pct1(f.theta)} %${f.sensorId ? ` (givare ${esc(f.sensorId)})` : ''}`],
    ['Fältkapacitet, full jord', `${pct1(f.thetaFc)} %`],
    ['Torrgräns för grödan', `${pct1(f.thetaDry)} %`],
    ['Vissningsgräns', `${pct1(f.thetaWp)} %`],
    ['Rotdjup', `${fmt2(f.rootDepth)} m`],
    ['Vatten som saknas upp till full jord (D)', `${fmt1(f.deficit)} mm`],
    ['Lättillgängligt vatten (RAW)', `${fmt1(f.raw)} mm`],
    ['Totalt tillgängligt vatten (TAW)', `${fmt1(f.taw)} mm`],
    ['Grödkoefficient (Kc)', fmt2(f.kc)],
    ['Grödans vattenbehov', `${fmt1(f.etcPerDay)} mm per dygn`],
    ['Regn i prognosen, sju dygn', `${fmt0(rain7)} mm`],
  ];
  if (pass) {
    rows.push(
      ['Giva', `${fmt0(pass.mm)} mm${pass.limit === 'water' ? `, dammen räcker inte till ${fmt0(pass.wantedMm)} mm` : pass.limit === 'pump' ? `, pumpen hinner inte ${fmt0(pass.wantedMm)} mm` : ''}`],
      ['Vatten', `${fmt0(pass.mm)} mm × ${fmt1(f.areaHa)} ha × 10 = ${fmtM3(pass.volumeM3)} m³`],
      ['Pumptid', `${fmtM3(pass.volumeM3)} m³ ÷ ${fmt0(pump.flowM3h)} m³/h = ${fmtHours(pass.hours)}`],
    );
  }
  if (f.valuePerM3 > 0) rows.push(['Räddat värde per m³ vatten', `${fmt1(f.valuePerM3)} kr`]);
  return `<details class="behind"><summary>Siffrorna bakom rådet</summary>${facts(rows)}
    <p class="hint">Regeln: vattna när underskottet väntas passera det lättillgängliga vattnet inom två dygn, om inte mer än 10 mm regn väntas. Givan fyller jorden till fältkapacitet, högst ${fmt0(pump.maxDoseMm)} mm åt gången.</p>
  </details>`;
}

function adviceBox(f) {
  const a = f.advice;
  const tone = { tonight: 'warn', short: 'bad', hold: 'ok', planned: 'ok', none: 'ok' }[a.kind];
  return `<div class="advicebox advicebox--${tone}">
    ${icon(a.kind === 'tonight' ? 'pond' : tone)}
    <div><b>${esc(a.title)}</b><span>${esc(a.reason)}</span></div>
  </div>`;
}

export function fieldDetail(s, id) {
  const f = s.fields.find((x) => x.id === id);
  if (!f) return `<a class="backlink" href="#/aker">${icon('back')}Åkern</a><p>Fältet finns inte.</p>`;
  const e = s.economy.perField.find((x) => x.fieldId === id);
  return `<a class="backlink" href="#/aker">${icon('back')}Åkern</a>
  <div class="grid grid--two">
    <section class="card card--span">
      <header class="card__head"><h1>${esc(f.name)}</h1>${pill(f.status, f.statusText)}</header>
      <p class="muted">${esc(f.cropName)} · ${fmt1(f.areaHa)} ha · ${esc(f.soilName.toLowerCase())}</p>
      <p class="big">${pct1(f.theta)} <small>% markfukt</small></p>
      ${moistureBar(f)}
      <div class="mbar__legend"><span>Vissnar ${pct1(f.thetaWp)} %</span><span>Torrgräns ${pct1(f.thetaDry)} %</span><span>Full ${pct1(f.thetaFc)} %</span></div>
      <p class="card__line"><b>${daysOkText(f)}</b> utan regn eller bevattning.</p>
      ${adviceBox(f)}
      ${numbersBehind(f, s)}
    </section>

    <section class="card card--span">
      <header class="card__head"><h2>Markfukt, tre veckor bakåt och sju dygn framåt</h2></header>
      ${fieldChart(f, s)}
    </section>

    <section class="card">
      <header class="card__head"><h2>Grödan</h2></header>
      ${facts([
        ['Gröda', esc(f.cropName)],
        ['Utvecklingsstadium', `${f.stage.name}, dag ${fmt0(f.stage.day)} av ${fmt0(f.stage.seasonDays)}`],
        ['Sådd', dateShort(f.sowDate)],
        ['Jordart', esc(f.soilName)],
        ['Areal', `${fmt1(f.areaHa)} ha`],
      ])}
    </section>

    <section class="card">
      <header class="card__head"><h2>Vad står på spel</h2></header>
      ${facts([
        ['Grödans värde nu', fmtKr(e.valueKr)],
        ['I riskzonen utan vatten på sju dygn', fmtKr(e.riskKr)],
        ['Kostnad per mm bevattning', fmtKr(e.costPerMmKr)],
      ])}
      <p class="hint">Uppskattning. Se Ekonomi för antagandena.</p>
    </section>
  </div>`;
}

// --- Bevattning ------------------------------------------------------------

const KIND_ORDER = { tonight: 0, short: 1, hold: 2, planned: 3, none: 4 };

function weekGrid(s) {
  const nights = s.plan.nights;
  return `<div class="weekwrap"><table class="week">
    <thead><tr><th scope="col">Natt</th>${nights.map((n) => `<th scope="col">${weekdayShort(n.date)}</th>`).join('')}</tr></thead>
    <tbody>
      <tr class="week__wx"><th scope="row">Regn, mm</th>${s.weather.forecast.map((w) => `<td>${w.rain >= 0.5 ? fmt0(w.rain) : '–'}</td>`).join('')}</tr>
      ${s.fields.map((f) => `<tr><th scope="row">${esc(f.name)}</th>${nights.map((n) => {
        const p = n.passes.find((x) => x.fieldId === f.id);
        const hold = f.schedule.holds.some((h) => h.night === n.night);
        if (p) return `<td><span class="dose${n.night === 0 ? ' dose--now' : ''}">${fmt0(p.mm)}</span></td>`;
        if (hold) return '<td><span class="dose dose--hold" title="Väntar på regn">regn</span></td>';
        return '<td><span class="dose dose--none">·</span></td>';
      }).join('')}</tr>`).join('')}
    </tbody>
  </table></div>
  <p class="hint">Siffran är givan i mm natten efter den dagen. Planen räknas om varje dag när nya mätvärden och prognoser kommer.</p>`;
}

function planCard(f, s) {
  const a = f.advice;
  const p = a.pass;
  const later = s.plan.nights
    .filter((n) => n.passes.some((x) => x.fieldId === f.id) && !(p && n.passes.includes(p)))
    .map((n) => `${fmt0(n.passes.find((x) => x.fieldId === f.id).mm)} mm ${relNight(s.today, n.night)}`);
  const numbers = p ? `<ul class="doseline">
      <li><b>${fmt0(p.mm)} mm</b><span>giva</span></li>
      <li><b>${fmtM3(p.volumeM3)} m³</b><span>ur dammen</span></li>
      <li><b>${fmtHours(p.hours)}</b><span>${a.kind === 'tonight' ? `${p.start}–${p.end}` : 'pumptid'}</span></li>
    </ul>` : '';
  const limited = p && p.limit
    ? `<p class="limit">${icon('warn')}${p.limit === 'water' ? 'Dammen' : 'Pumpen'} räcker inte till hela givan på ${fmt0(p.wantedMm)} mm.</p>`
    : '';
  return `<section class="card plancard plancard--${a.kind}">
    <header class="card__head"><h2>${esc(f.name)}</h2><span class="muted">${esc(f.cropName)} · ${fmt1(f.areaHa)} ha</span></header>
    <p class="plancard__title">${esc(a.title)}</p>
    ${numbers}${limited}
    <p class="why"><b>Varför?</b> ${esc(a.reason)}</p>
    ${later.length ? `<p class="hint">Därefter: ${later.join(', ')}.</p>` : ''}
    ${a.kind === 'tonight' ? `<button type="button" class="btn btn--done" data-action="done" data-key="${p.key}" data-field="${f.id}" data-mm="${p.mm}" data-m3="${p.volumeM3}">${icon('check')}Gjort</button>` : ''}
    ${numbersBehind(f, s)}
  </section>`;
}

export function plan(s) {
  const { plan: pl, pond: p, headline: h } = s;
  const tonight = pl.tonight;
  const sorted = s.fields.slice().sort((a, b) =>
    KIND_ORDER[a.advice.kind] - KIND_ORDER[b.advice.kind] || b.valuePerM3 - a.valuePerM3);

  const summary = `<section class="hero hero--${h.status} hero--compact">
    <div class="hero__icon">${icon(h.status)}</div>
    <div class="hero__body">
      <p class="eyebrow">Bevattningsplan, sju dygn</p>
      <h1>${esc(h.title)}</h1>
      <p class="hero__text">${esc(h.text)}</p>
    </div>
    ${tonight.passes.length ? `<ul class="statuslist statuslist--hero">
      <li>${icon('clock')}<span>Starta pumpen omkring <b>22:00</b>. Den går till ungefär <b>${tonight.passes[tonight.passes.length - 1].end}</b>.</span></li>
      <li>${icon('pond')}<span>Dammen har <b>${fmtM3(pl.usableNowM3)} m³</b> användbart. Efter i natt <b>${fmtM3(pl.usableAfterTonightM3)} m³</b>.</span></li>
      ${tonight.windy
        ? `<li class="is-warn">${icon('wind')}<span>Hård vind väntas, <b>${fmt0(tonight.wind)} m/s</b>. Vattna när vinden mojnat, annars blåser vattnet bort.</span></li>`
        : `<li>${icon('wind')}<span>Svag vind i natt, ${fmt0(tonight.wind)} m/s. Natten är bäst: minst vind och avdunstning.</span></li>`}
    </ul>` : ''}
  </section>`;

  const shortage = pl.waterShort ? `<section class="card card--bad">
    <header class="card__head"><h2>${icon('bad')}Vattnet räcker inte till allt</h2></header>
    <p class="card__line">Veckans behov är <b>${fmtM3(pl.wantedM3)} m³</b>. Dammen har <b>${fmtM3(pl.usableNowM3)} m³</b> användbart. Vattnet går först dit det räddar mest värde per kubikmeter.</p>
    ${rankingList(pl.ranking)}
  </section>` : '';

  const done = pl.done.length ? `<section class="card">
    <header class="card__head"><h2>${icon('check')}Gjort</h2></header>
    <ul class="donelist">${pl.done.map((d) => `<li>
      <div><b>${esc(d.fieldName)}</b><span>${fmt0(d.mm)} mm · ${fmtM3(d.volumeM3)} m³ · avbockat ${clock(d.ts)}</span></div>
      <button type="button" class="btn btn--ghost" data-action="undo" data-id="${esc(d.id)}">${icon('undo')}Ångra</button>
    </li>`).join('')}</ul>
    <p class="hint">Avbockad bevattning dras från dammen och läggs till markfukten direkt.</p>
  </section>` : '';

  return `<div class="stack">
    ${summary}
    ${shortage}
    <section class="card">
      <header class="card__head"><h2>Veckan i en blick</h2></header>
      ${weekGrid(s)}
    </section>
    <div class="pagehead pagehead--sub"><h2>Fält för fält</h2></div>
    <div class="grid grid--two">${sorted.map((f) => planCard(f, s)).join('')}</div>
    ${done}
    ${!pl.waterShort && pl.ranking.length > 1 ? `<details class="card behind behind--card"><summary>Om vattnet inte skulle räcka</summary>
      <p class="card__line">Då går vattnet först dit det räddar mest värde per kubikmeter:</p>${rankingList(pl.ranking)}</details>` : ''}
  </div>`;
}

const rankingList = (ranking) => `<ol class="ranking">${ranking.map((r) => `<li>
    <div><b>${esc(r.name)}</b><span>${esc(r.cropName)}</span></div>
    <div class="ranking__num"><b>${fmt1(r.valuePerM3)} kr per m³</b>
      <span>${r.grantedM3 >= r.wantedM3 - 1 ? `får ${fmtM3(r.grantedM3)} m³` : r.grantedM3 < 1 ? `får inget av ${fmtM3(r.wantedM3)} m³` : `får ${fmtM3(r.grantedM3)} av ${fmtM3(r.wantedM3)} m³`}</span></div>
  </li>`).join('')}</ol>`;

// --- Ekonomi ---------------------------------------------------------------

export function economy(s, ui) {
  const e = s.economy;
  const crop = e.prices.find((c) => c.cropId === ui.priceCrop) || e.prices[0];
  const points = crop ? crop.history.map((h) => ({ x: localMidnight(h.date), y: h.price })) : [];
  const priceChart = crop ? chartSlot('price', {
    height: 210,
    unit: 'kr/ton',
    digits: 0,
    label: `Pris för ${crop.cropName} det senaste året. Nu ${fmt0(crop.current)} kronor per ton.`,
    series: [{ name: crop.cropName, color: TEAL, points }],
    xTicks: timeTicks(points, 'year'),
    xLabel: (t) => `vecka med ${dateShort(isoOf(t))}`,
  }) : '';

  return `<div class="grid grid--two">
    <section class="card card--span">
      <header class="card__head"><h1>Ekonomi</h1><span class="tag">Uppskattning</span></header>
      <div class="kpis">
        <div><span>Grödornas värde nu</span><b>${fmtKr(e.totalValueKr)}</b></div>
        <div class="${e.totalRiskKr >= 500 ? 'kpi--risk' : ''}"><span>I riskzonen, sju dygn utan vatten</span><b>${fmtKr(e.totalRiskKr)}</b></div>
        <div><span>Planerad bevattning kostar</span><b>${fmtKr(e.totalCostKr)}</b></div>
        <div><span>Planen räddar</span><b>${fmtKr(e.totalSavedKr)}</b></div>
      </div>
      ${e.totalCostKr > 0 && e.totalSavedKr > 0
        ? `<p class="card__line">Varje krona i pumpkostnad räddar ungefär <b>${fmt0(e.totalSavedKr / e.totalCostKr)} kr</b> i skörd den här veckan.</p>`
        : '<p class="card__line">Ingen bevattning är planerad den här veckan.</p>'}
    </section>

    ${e.perField.map((f) => `<section class="card">
      <header class="card__head"><h2>${esc(f.name)}</h2><span class="muted">${esc(f.cropName)}</span></header>
      <p class="big">${fmtKr(f.valueKr)}</p>
      <p class="hint">${fmt1(f.areaHa)} ha × ${fmt1(f.yieldTHa)} ton/ha × ${fmt0(f.priceKrT)} kr/ton</p>
      ${facts([
        ['I riskzonen utan vatten', f.riskKr >= 50 ? `<b class="risk">${fmtKr(f.riskKr)}</b>` : 'Inget'],
        ['Planerad bevattning', f.plannedM3 > 0 ? `${fmt0(f.plannedMm)} mm, ${fmtKr(f.costKr)}` : 'Ingen'],
        ['Bevattningen räddar', f.plannedM3 > 0 ? fmtKr(f.savedKr) : '–'],
        ['Tillbaka per satsad krona', f.returnPerKr ? `${fmt0(f.returnPerKr)} kr` : '–'],
        ['Kostnad per mm på fältet', fmtKr(f.costPerMmKr)],
      ])}
    </section>`).join('')}

    <section class="card card--span">
      <header class="card__head card__head--wrap"><h2>Prishistorik</h2>
        ${crop ? seg('priceCrop', crop.cropId, e.prices.map((c) => [c.cropId, c.cropName.split(' ')[0]])) : ''}</header>
      ${crop ? `<p class="card__line">${esc(crop.cropName)} nu: <b>${fmt0(crop.current)} kr/ton</b></p>${priceChart}` : '<p class="muted">Inga grödor inlagda.</p>'}
    </section>

    <section class="card card--span">
      <header class="card__head"><h2>Så har vi räknat</h2></header>
      <ul class="assume">
        <li><b>Värde</b> = areal × förväntad skörd × dagens pris. Priserna är exempel tills en priskälla är vald.</li>
        <li><b>I riskzonen</b> är den skörd som väntas gå förlorad om fältet inte får vatten på sju dygn. Vattenbristen under veckan sätts i förhållande till grödans behov under hela säsongen (FAO 33).</li>
        <li><b>Kostnad</b> är pumpens el: ${fmt0(s.config.pump.powerKw)} kW × drifttid × ${fmt2(s.config.prices.elKrKwh)} kr/kWh${s.config.prices.waterFeeKrM3 > 0 ? `, plus ${fmt2(s.config.prices.waterFeeKrM3)} kr per m³ i vattenavgift` : ''}. Arbete och slitage ingår inte.</li>
        <li>Skörd, pris och grödornas känslighet för torka är startvärden. De ska stämmas av mot gårdens egna siffror.</li>
      </ul>
    </section>
  </div>`;
}

// --- Larm ------------------------------------------------------------------

export function alarms(s) {
  const th = s.config.thresholds;
  const p = s.config.pond;
  return `<div class="pagehead"><h1>Larm</h1>${s.alarms.length ? pill(s.alarms.some((a) => a.severity === 'bad') ? 'bad' : 'warn', s.alarms.length === 1 ? '1 aktivt' : `${s.alarms.length} aktiva`) : pill('ok', 'Inga larm')}</div>
  <div class="grid grid--two">
    <section class="card">
      <header class="card__head"><h2>Aktiva larm</h2></header>
      ${s.alarms.length ? `<ul class="alarms">${s.alarms.map(alarmRow).join('')}</ul>` : '<p class="card__line">Allt ser bra ut just nu.</p>'}
    </section>
    <section class="card">
      <header class="card__head"><h2>Gränser för larm</h2></header>
      ${facts([
        ['Lågt syre', `under ${fmt1(th.doLow)} mg/L`],
        ['Mycket lågt syre', `under ${fmt1(th.doCritical)} mg/L`],
        ['Låg vattennivå', `under ${fmt2(p.hMin + th.levelMarginM)} m`],
        ['Dammen räcker kort tid', `under ${fmt0(th.pondDaysCritical)} dygn`],
        ['Torrt fält', 'under grödans torrgräns'],
        ['Bojen tyst', `ingen mätning på ${fmt0(th.silentMin)} min`],
        ['Lågt batteri', `under ${fmt0(th.battLow)} %`],
      ])}
      <a class="btn btn--ghost" href="#/installningar">Ändra gränserna ${icon('chevron')}</a>
      <p class="hint">Pushnotiser till mobilen kommer i en senare version. Tills dess visas larmen här och på översikten.</p>
    </section>
  </div>`;
}

// --- Inställningar ---------------------------------------------------------

const num = (label, path, value, unit, hint = '') => `<label class="fld">
  <span class="fld__label">${label}</span>
  <span class="fld__in"><input type="number" inputmode="decimal" step="any" min="0" data-path="${path}" value="${value}"><em>${unit}</em></span>
  ${hint ? `<span class="fld__hint">${hint}</span>` : ''}
</label>`;

const text = (label, path, value, type = 'text') => `<label class="fld">
  <span class="fld__label">${label}</span>
  <span class="fld__in"><input type="${type}" data-path="${path}" value="${esc(value)}"></span>
</label>`;

const select = (label, path, value, options) => `<label class="fld">
  <span class="fld__label">${label}</span>
  <span class="fld__in"><select data-path="${path}">${options
    .map(([v, name]) => `<option value="${v}"${v === value ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></span>
</label>`;

export function settings(s, demo) {
  const c = s.config;
  const cropOptions = Object.entries(CROPS).map(([id, crop]) => [id, crop.name]);
  const soilOptions = Object.entries(SOILS).map(([id, soil]) => [id, soil.name]);

  return `<div class="pagehead"><h1>Inställningar</h1></div>
  <div class="stack">
    <section class="card card--demo">
      <header class="card__head"><h2>Demoläge</h2><span class="tag">Simulerad data</span></header>
      <p class="card__line">All data i appen är simulerad och spelas upp på ${dateLong(s.today)}. Välj ett läge att visa:</p>
      <div class="scenarios">${Object.entries(SCENARIOS).map(([id, scn]) => `<button type="button" class="scenario" data-action="scenario" data-value="${id}" aria-pressed="${id === demo.scenario}">
        <b>${scn.name}</b><span>${scn.desc}</span>
      </button>`).join('')}</div>
      <label class="check"><input type="checkbox" data-demo="silent"${demo.silent ? ' checked' : ''}><span><b>Bojen är tyst</b> Ingen mätning på tre timmar. Appen visar senast kända värden.</span></label>
      <label class="check"><input type="checkbox" data-demo="lowBattery"${demo.lowBattery ? ' checked' : ''}><span><b>Lågt batteri i bojen</b></span></label>
      <button type="button" class="btn btn--ghost" data-action="reset">${icon('undo')}Återställ demon</button>
    </section>

    <section class="card">
      <header class="card__head"><h2>Gård</h2></header>
      <div class="form">${text('Gårdens namn', 'farm.name', c.farm.name)}</div>
    </section>

    <section class="card">
      <header class="card__head"><h2>Damm</h2></header>
      <div class="form">
        ${num('Bottenarea', 'pond.a0', c.pond.a0, 'm²')}
        ${num('Area vid full nivå', 'pond.aMax', c.pond.aMax, 'm²')}
        ${num('Djup vid full nivå', 'pond.depth', c.pond.depth, 'm')}
        ${num('Lägsta nivå pumpen når', 'pond.hMin', c.pond.hMin, 'm')}
      </div>
      <p class="hint">Full damm rymmer ${fmtM3(s.pond.fullVolume)} m³, varav ${fmtM3(s.pond.capacity)} m³ går att pumpa.</p>
    </section>

    <section class="card">
      <header class="card__head"><h2>Fält</h2></header>
      ${c.fields.map((f, i) => `<details class="fieldform"${c.fields.length === 1 ? ' open' : ''}>
        <summary><b>${esc(f.name)}</b><span>${esc(CROPS[f.crop].name)} · ${fmt1(f.areaHa)} ha</span></summary>
        <div class="form">
          ${text('Namn', `fields.${i}.name`, f.name)}
          ${num('Areal', `fields.${i}.areaHa`, f.areaHa, 'ha')}
          ${select('Gröda', `fields.${i}.crop`, f.crop, cropOptions)}
          ${text('Sådatum', `fields.${i}.sowDate`, f.sowDate, 'date')}
          ${select('Jordart', `fields.${i}.soil`, f.soil, soilOptions)}
          ${num('Förväntad skörd', `fields.${i}.yieldTHa`, f.yieldTHa, 'ton/ha')}
          ${text('Markfuktgivare', `fields.${i}.sensorId`, f.sensorId || '')}
        </div>
        <button type="button" class="btn btn--ghost btn--danger" data-action="remove-field" data-index="${i}">${icon('trash')}Ta bort fältet</button>
      </details>`).join('')}
      <button type="button" class="btn btn--ghost" data-action="add-field">${icon('plus')}Lägg till fält</button>
    </section>

    <section class="card">
      <header class="card__head"><h2>Pump och priser</h2></header>
      <div class="form">
        ${num('Pumpens flöde', 'pump.flowM3h', c.pump.flowM3h, 'm³/h')}
        ${num('Pumpens effekt', 'pump.powerKw', c.pump.powerKw, 'kW')}
        ${num('Längsta körning per natt', 'pump.maxHoursPerNight', c.pump.maxHoursPerNight, 'h')}
        ${num('Största giva per tillfälle', 'pump.maxDoseMm', c.pump.maxDoseMm, 'mm')}
        ${num('Elpris', 'prices.elKrKwh', c.prices.elKrKwh, 'kr/kWh')}
        ${num('Vattenavgift', 'prices.waterFeeKrM3', c.prices.waterFeeKrM3, 'kr/m³')}
      </div>
    </section>

    <section class="card">
      <header class="card__head"><h2>Larmgränser</h2></header>
      <div class="form">
        ${num('Lågt syre under', 'thresholds.doLow', c.thresholds.doLow, 'mg/L')}
        ${num('Mycket lågt syre under', 'thresholds.doCritical', c.thresholds.doCritical, 'mg/L')}
        ${num('Marginal över lägsta pumpnivå', 'thresholds.levelMarginM', c.thresholds.levelMarginM, 'm')}
        ${num('Varna när dammen räcker kortare än', 'thresholds.pondDaysWarn', c.thresholds.pondDaysWarn, 'dygn')}
        ${num('Larma när dammen räcker kortare än', 'thresholds.pondDaysCritical', c.thresholds.pondDaysCritical, 'dygn')}
        ${num('Lågt batteri under', 'thresholds.battLow', c.thresholds.battLow, '%')}
        ${num('Bojen räknas som tyst efter', 'thresholds.silentMin', c.thresholds.silentMin, 'min')}
      </div>
      <p class="hint">Gränserna ställs in per gård. Ändringar sparas direkt.</p>
    </section>
  </div>`;
}
