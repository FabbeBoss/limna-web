// Dates and Swedish formatting. Calendar days are ISO strings ('2026-07-08'),
// compared as whole day numbers so daylight saving never shifts anything.

export const DAY_MS = 86400000;

export const dayNum = (iso) =>
  Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS);

export const isoFromDayNum = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export const addDays = (iso, n) => isoFromDayNum(dayNum(iso) + n);

/** Local midnight of a calendar day, as a timestamp. */
export const localMidnight = (iso) =>
  new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)).getTime();

export const dayOfYear = (iso) => dayNum(iso) - dayNum(iso.slice(0, 4) + '-01-01') + 1;

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// --- Formatting ------------------------------------------------------------

const nf = (digits) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const nf0 = nf(0);
const nf1 = nf(1);
const nf2 = nf(2);

export const fmt0 = (x) => (Number.isFinite(x) ? nf0.format(Math.round(x)) : '–');
export const fmt1 = (x) => (Number.isFinite(x) ? nf1.format(x) : '–');
export const fmt2 = (x) => (Number.isFinite(x) ? nf2.format(x) : '–');

/** Money rounded to what the estimate can bear: 12 400 kr, 1,15 mkr. */
export function fmtKr(x) {
  if (!Number.isFinite(x)) return '– kr';
  const abs = Math.abs(x);
  if (abs >= 1e6) return `${nf2.format(x / 1e6)} mkr`;
  if (abs >= 100000) return `${nf0.format(Math.round(x / 1000) * 1000)} kr`;
  if (abs >= 10000) return `${nf0.format(Math.round(x / 100) * 100)} kr`;
  if (abs >= 1000) return `${nf0.format(Math.round(x / 10) * 10)} kr`;
  return `${nf0.format(Math.round(x))} kr`;
}

/** Volume rounded to 10 m³ above 1000, since the level reading is no finer than that. */
export function fmtM3(x) {
  if (!Number.isFinite(x)) return '–';
  return nf0.format(Math.abs(x) >= 1000 ? Math.round(x / 10) * 10 : Math.round(x));
}

/** Hours as "4 h 20 min". */
export function fmtHours(h) {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = Math.round((total % 60) / 5) * 5;
  if (mm === 60) return `${hh + 1} h`;
  if (hh === 0) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

const WEEKDAYS = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const WEEKDAYS_SHORT = ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'];
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const MONTHS_SHORT = ['jan', 'feb', 'mars', 'apr', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];

const weekdayIndex = (iso) => new Date(dayNum(iso) * DAY_MS).getUTCDay();

export const weekday = (iso) => WEEKDAYS[weekdayIndex(iso)];
export const weekdayShort = (iso) => WEEKDAYS_SHORT[weekdayIndex(iso)];
export const dateShort = (iso) => `${+iso.slice(8, 10)} ${MONTHS_SHORT[+iso.slice(5, 7) - 1]}`;
export const dateLong = (iso) => `${weekday(iso)} ${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;

/** "i dag", "i morgon" or the weekday, for a day counted from today. */
export function relDay(todayIso, offset) {
  if (offset === 0) return 'i dag';
  if (offset === 1) return 'i morgon';
  return `på ${weekday(addDays(todayIso, offset))}`;
}

/** The night that starts on the evening of the given day. */
export function relNight(todayIso, offset) {
  if (offset === 0) return 'i natt';
  if (offset === 1) return 'i morgon natt';
  return `natten mot ${weekday(addDays(todayIso, offset + 1))}`;
}

export const clock = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Clock time a number of hours after a start hour, wrapping past midnight. */
export function clockAfter(startHour, hours) {
  const total = Math.round(((startHour + hours) * 60) / 5) * 5; // nearest five minutes
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function ago(minutes) {
  if (minutes < 1) return 'nyss';
  if (minutes < 60) return `${Math.round(minutes)} min sedan`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min sedan` : `${h} h sedan`;
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "A", "A och B", "A, B och C". */
export function listAnd(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`;
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
