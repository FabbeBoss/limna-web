// Shell, routing and events. State lives here; everything shown is rebuilt
// from one snapshot each time something changes.

import { buildSnapshot } from './model.js';
import { loadState, saveState, freshState } from './store.js';
import { DEMO_DATE, SCENARIOS } from './defaults.js';
import { CROPS } from './crops.js';
import { clearCharts, mountCharts } from './charts.js';
import { mountMap } from './map.js';
import { icon } from './icons.js';
import { clock, ago, escapeHtml } from './util.js';
import * as views from './views.js';

let state = loadState();

// Choices that only affect what is shown, not the farm's data.
const ui = { pondMetric: 'lvl', pondRange: 'week', balanceRange: 'week', priceCrop: null, mapHeat: 'on', mapSelected: null };

const NAV = [
  { route: 'oversikt', label: 'Översikt', icon: 'home' },
  { route: 'damm', label: 'Dammen', icon: 'pond' },
  { route: 'aker', label: 'Åkern', icon: 'field' },
  { route: 'plan', label: 'Bevattning', icon: 'plan' },
  { route: 'ekonomi', label: 'Ekonomi', icon: 'money' },
  { route: 'larm', label: 'Larm', icon: 'bell', extra: true },
  { route: 'installningar', label: 'Inställningar', icon: 'settings', extra: true },
];

/** The demo plays on a fixed summer day, at the real time of day. */
function demoNow() {
  const real = new Date();
  return new Date(+DEMO_DATE.slice(0, 4), +DEMO_DATE.slice(5, 7) - 1, +DEMO_DATE.slice(8, 10),
    real.getHours(), real.getMinutes()).getTime();
}

function currentRoute() {
  const [route, param] = location.hash.replace(/^#\/?/, '').split('/');
  return { route: NAV.some((n) => n.route === route) ? route : 'oversikt', param };
}

function renderShell(snapshot, route) {
  const alarmCount = snapshot.alarms.length;
  const latest = snapshot.pond.latest;
  const scenario = SCENARIOS[state.demo.scenario];

  document.getElementById('top').innerHTML = `
    <a class="brand" href="#/oversikt" aria-label="LIMNA, till översikten"><i class="brand__ic" aria-hidden="true"></i><i class="brand__wm" aria-hidden="true"></i></a>
    <span class="top__farm">${escapeHtml(snapshot.farm.name)}</span>
    <a class="iconbtn" href="#/larm" aria-label="Larm${alarmCount ? `, ${alarmCount} aktiva` : ''}"${route === 'larm' ? ' aria-current="page"' : ''}>
      ${icon('bell')}${alarmCount ? `<span class="badge">${alarmCount}</span>` : ''}</a>
    <a class="iconbtn" href="#/installningar" aria-label="Inställningar"${route === 'installningar' ? ' aria-current="page"' : ''}>${icon('settings')}</a>`;

  document.getElementById('nav').innerHTML = `
    <a class="brand brand--side" href="#/oversikt" aria-label="LIMNA, till översikten"><i class="brand__ic" aria-hidden="true"></i><i class="brand__wm" aria-hidden="true"></i></a>
    <span class="nav__farm">${escapeHtml(snapshot.farm.name)}</span>
    ${NAV.map((n) => `<a class="nav__item${n.extra ? ' nav__item--extra' : ''}" href="#/${n.route}"${n.route === route ? ' aria-current="page"' : ''}>
      ${icon(n.icon)}<span>${n.label}</span>${n.route === 'larm' && alarmCount ? `<span class="badge">${alarmCount}</span>` : ''}
    </a>`).join('')}`;

  document.getElementById('statusline').className = `statusline${latest.silent ? ' statusline--warn' : ''}`;
  document.getElementById('statusline').innerHTML = latest.silent
    ? `${icon('nosignal')}<span><b>Bojen är tyst sedan ${clock(latest.t)}.</b> Appen visar senast kända värden.</span>`
    : `${icon('clock')}<span>Senaste mätning <b>${clock(latest.t)}</b>, ${ago(latest.ageMin)}</span>
       <a class="statusline__demo" href="#/installningar">Demo: ${escapeHtml(scenario.name)}</a>`;
}

function render({ keepScroll = true } = {}) {
  const { route, param } = currentRoute();
  const snapshot = buildSnapshot(state.config, state.log, state.demo, DEMO_DATE, demoNow());
  if (!ui.priceCrop || !snapshot.economy.prices.some((p) => p.cropId === ui.priceCrop)) {
    ui.priceCrop = snapshot.economy.prices[0]?.cropId ?? null;
  }

  const view = document.getElementById('view');
  const scroll = window.scrollY;
  const openDetails = [...view.querySelectorAll('details[open] > summary')].map((el) => el.textContent);
  clearCharts();
  renderShell(snapshot, route);

  let html;
  if (route === 'damm') html = views.pond(snapshot, ui);
  else if (route === 'aker') html = param ? views.fieldDetail(snapshot, param) : views.fields(snapshot, ui);
  else if (route === 'plan') html = views.plan(snapshot);
  else if (route === 'ekonomi') html = views.economy(snapshot, ui);
  else if (route === 'larm') html = views.alarms(snapshot);
  else if (route === 'installningar') html = views.settings(snapshot, state.demo);
  else html = views.overview(snapshot);
  view.innerHTML = html;
  view.dataset.route = route;

  // Keep opened sections open across a re-render.
  view.querySelectorAll('details > summary').forEach((el) => {
    if (openDetails.includes(el.textContent)) el.parentElement.open = true;
  });
  mountCharts(view);
  mountMap(view, selectOnMap);
  if (keepScroll) window.scrollTo(0, scroll);
  else window.scrollTo(0, 0);
  document.title = `${NAV.find((n) => n.route === route).label} · LIMNA`;
}

/** Tapping a field or the pond on the map shows it underneath. Tapping it again, or the ground, clears it. */
function selectOnMap(id) {
  ui.mapSelected = id === ui.mapSelected ? null : id;
  render();
}

function commit() {
  saveState(state);
  render();
}

// --- Settings --------------------------------------------------------------

function setPath(object, path, value) {
  const keys = path.split('.');
  let target = object;
  for (const key of keys.slice(0, -1)) target = target[key];
  target[keys[keys.length - 1]] = value;
}

function onSettingChange(input) {
  const path = input.dataset.path;
  let value = input.value;
  if (input.type === 'number') {
    value = Number(String(value).replace(',', '.'));
    const mayBeZero = /waterFee|levelMargin|a0$/.test(path);
    if (!Number.isFinite(value) || value < 0 || (value === 0 && !mayBeZero)) return render();
  } else if (input.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return render();
  } else {
    value = value.trim();
    if (!value && /name$/.test(path)) return render();
  }
  setPath(state.config, path, value);

  // Keep the pond geometry possible, and give a new crop its usual yield.
  const pond = state.config.pond;
  if (pond.aMax < pond.a0) pond.aMax = pond.a0;
  if (pond.hMin >= pond.depth) pond.hMin = Math.max(0, pond.depth - 0.1);
  const crop = path.match(/^fields\.(\d+)\.crop$/);
  if (crop) state.config.fields[+crop[1]].yieldTHa = CROPS[value].yieldTHa;
  commit();
}

// --- Events ----------------------------------------------------------------

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'ui') {
    ui[el.dataset.key] = el.dataset.value;
    render();
  } else if (action === 'done') {
    state.log.push({
      id: `${el.dataset.key}#${Date.now()}`,
      key: el.dataset.key,
      fieldId: el.dataset.field,
      date: DEMO_DATE,
      mm: Number(el.dataset.mm),
      volumeM3: Number(el.dataset.m3),
      ts: demoNow(),
    });
    commit();
  } else if (action === 'undo') {
    state.log = state.log.filter((e) => e.id !== el.dataset.id);
    commit();
  } else if (action === 'scenario') {
    state.demo.scenario = el.dataset.value;
    state.log = []; // ticked-off irrigations belong to the scenario they were made in
    commit();
  } else if (action === 'reset') {
    if (confirm('Återställa demon? Gården, fälten och avbockade bevattningar går tillbaka till utgångsläget.')) {
      state = freshState();
      commit();
    }
  } else if (action === 'add-field') {
    state.config.fields.push({
      id: `f${Date.now()}`,
      name: `Fält ${state.config.fields.length + 1}`,
      areaHa: 2,
      crop: 'potatis',
      sowDate: '2026-05-01',
      soil: 'lattlera',
      yieldTHa: CROPS.potatis.yieldTHa,
      sensorId: '',
    });
    commit();
  } else if (action === 'remove-field') {
    const field = state.config.fields[+el.dataset.index];
    if (field && confirm(`Ta bort ${field.name}?`)) {
      state.config.fields.splice(+el.dataset.index, 1);
      state.log = state.log.filter((e) => e.fieldId !== field.id);
      commit();
    }
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.path) onSettingChange(el);
  else if (el.dataset.demo) {
    state.demo[el.dataset.demo] = el.checked;
    commit();
  }
});

window.addEventListener('hashchange', () => render({ keepScroll: false }));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    mountCharts(document.getElementById('view'));
    mountMap(document.getElementById('view'), selectOnMap);
  }, 150);
});

// New readings arrive every quarter of an hour. Leave the page alone while someone is typing.
setInterval(() => {
  const active = document.activeElement;
  if (active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) return;
  render();
}, 60000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render({ keepScroll: false });
