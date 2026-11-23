// What the farmer has entered, kept in the browser for the demo.
// In production this is the farm's rows in the backend database.

import { DEFAULT_CONFIG, DEFAULT_DEMO, SCENARIOS } from './defaults.js';

const KEY = 'limna.demo.v1';
const clone = (x) => JSON.parse(JSON.stringify(x));

export function freshState() {
  return { config: clone(DEFAULT_CONFIG), log: [], demo: clone(DEFAULT_DEMO) };
}

export function loadState() {
  const state = freshState();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.config && Array.isArray(saved.config.fields)) {
      // Settings added in a later version get their default value.
      for (const key of ['farm', 'pond', 'pump', 'prices', 'thresholds']) {
        state.config[key] = { ...state.config[key], ...saved.config[key] };
      }
      // Boundaries came after the first version: a saved demo field keeps the default's outline.
      state.config.fields = saved.config.fields.map((f) => {
        const d = DEFAULT_CONFIG.fields.find((x) => x.id === f.id);
        return f.polygon || !d?.polygon ? f : { ...f, polygon: d.polygon };
      });
      state.log = Array.isArray(saved.log) ? saved.log : [];
      state.demo = { ...state.demo, ...saved.demo };
      if (!SCENARIOS[state.demo.scenario]) state.demo.scenario = DEFAULT_DEMO.scenario;
    }
  } catch {
    // Private browsing or a broken entry: start from the demo farm.
  }
  return state;
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // The app still works for this visit.
  }
}
