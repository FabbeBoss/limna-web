// Inline SVG icons, drawn on a 24 px grid. No icon font, no network.

const svg = (body, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const PATHS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
  pond: '<path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  field: '<path d="M12 21v-9"/><path d="M12 12c0-4-3-6.5-7.5-6.5C4.5 9.500 7.500 12 12 12z"/><path d="M12 15.5c0-3 2.500-5 6.500-5 0 3-2.500 5-6.500 5z"/><path d="M5 21h14"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="2.500"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15.500 2 2 4-4"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2.500"/><circle cx="12" cy="12" r="2.600"/><path d="M6 12h.01M18 12h.01"/>',
  bell: '<path d="M6 9.500a6 6 0 0 1 12 0c0 5.500 2.500 6.500 2.500 6.500h-17S6 15 6 9.500z"/><path d="M10 19.500a2 2 0 0 0 4 0"/>',
  settings: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.500"/><circle cx="8" cy="17" r="2.500"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.500 2.700 2.700L16 9.500"/>',
  warn: '<path d="M12 4 21.500 20h-19z"/><path d="M12 10v4.500M12 17.300h.01"/>',
  bad: '<circle cx="12" cy="12" r="9"/><path d="M12 7.500v5.500M12 16.300h.01"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  undo: '<path d="M4 9h10a5 5 0 0 1 0 10h-3"/><path d="m8 5-4 4 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  map: '<path d="M3 6.500 9 4l6 2.500 6-2.500v13.500L15 20l-6-2.500-6 2.500z"/><path d="M9 4v13.500M15 6.500V20"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  battery: '<rect x="2.500" y="7.500" width="16" height="9" rx="2"/><path d="M21.500 11v2"/><path d="M6 10.500v3M9.500 10.500v3"/>',
  wind: '<path d="M3 9h10a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/>',
  signal: '<path d="M5 19v-3M10 19v-7M15 19V8M20 19V4"/>',
  nosignal: '<path d="M5 19v-3M10 19v-7"/><path d="m14.500 6 6 6M20.500 6l-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.300 5.300l1.400 1.400M17.300 17.300l1.400 1.400M5.300 18.700l1.400-1.400M17.300 6.700l1.400-1.400"/>',
  cloudsun: '<circle cx="8" cy="8" r="3"/><path d="M8 2v1.500M2 8h1.500M3.800 3.800l1 1M12.200 3.800l-1 1"/><path d="M10 20a3.500 3.500 0 0 1-.4-6.980A5 5 0 0 1 19 12.600 3.700 3.700 0 0 1 18.500 20z" fill="var(--surface)"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.5-7.970A6 6 0 0 1 18 6.500 4.250 4.250 0 0 1 17.500 15z"/><path d="M8.500 18.500 8 21M12.500 18.500 12 21M16.500 18.500 16 21"/>',
};

export const icon = (name, cls = '') => svg(PATHS[name] || '', cls);

/** Icon for a forecast day. */
export function weatherIcon(rainMm) {
  if (rainMm >= 3) return icon('rain');
  if (rainMm >= 0.5) return icon('cloudsun');
  return icon('sun');
}

/** The LIMNA mark: rings on water around the buoy. */
export const logo = (size = 30) =>
  `<svg class="logo" viewBox="0 0 32 32" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.600" aria-hidden="true">
    <circle cx="16" cy="16" r="14"/><circle cx="16" cy="16" r="9.500"/><circle cx="16" cy="16" r="5"/>
    <circle cx="16" cy="16" r="1.500" fill="currentColor" stroke="none"/>
  </svg>`;
