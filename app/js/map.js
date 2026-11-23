// Overhead map of the farm, coloured by how badly each field needs water.
//
// The picture is drawn, not photographed: the demo farm does not exist, so
// there is no real aerial image or field boundary to show. Parcels and the
// pond are laid out to scale from the areas in the settings, which means a
// field added there gets a place on the map straight away. When the pilot
// farm's boundaries are known, geometry() is the only part to replace.
//
// One soil sensor per field, so a whole field has one colour.

import { icon } from './icons.js';
import { fmt0, fmt1, fmt2, fmtM3, escapeHtml as esc } from './util.js';

// Ground tones seen from above, per crop, in July.
const TONES = {
  potatis: '#3f6b35', gronsaker: '#5f8c3e', varkorn: '#b3a25a',
  hostvete: '#bfa95c', raps: '#8c9846', sockerbetor: '#2f6a3b',
};
const NEIGHBOURS = ['#5c6b3f', '#6f7445', '#817a4d', '#4d6338', '#66703f', '#8a8355'];
const GROUND = '#4c5a37';

// The view survives a re-render, so ticking off an irrigation does not reset the zoom.
const view = { key: '', zoom: 1, cx: 0, cy: 0 };
const MAX_ZOOM = 6;

// --- Repeatable randomness, so the landscape is the same every time --------

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed) {
  let a = hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n1 = (x) => x.toFixed(1);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// --- Colour ----------------------------------------------------------------

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, t) {
  const [x, y] = [hex(a), hex(b)];
  const k = Math.min(1, Math.max(0, t));
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Colour for a field's need for water. The status picks the band, so the map
 * always agrees with the words; the dryness (deficit ÷ RAW) shades it within the band.
 *   ok   → green   bra, behöver inte vatten
 *   warn → yellow  snart
 *   bad  → red     behöver vatten nu
 */
export function needColour(status, dryness) {
  if (status === 'bad') return mix('#c2603a', '#8e2f20', (dryness - 1) / 0.35);
  if (status === 'warn') return mix('#e3c567', '#d69a3a', (dryness - 0.6) / 0.4);
  return mix('#3f8a5a', '#93b65a', dryness / 0.8);
}

// --- Geometry, in metres ---------------------------------------------------

/** Split a rectangle among items in proportion to their area, halving the list each time. */
function split(items, rect) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], ...rect }];
  const total = sum(items.map((i) => i.area));
  let k = 1;
  let best = Infinity;
  let acc = 0;
  for (let i = 0; i < items.length - 1; i++) {
    acc += items[i].area;
    if (Math.abs(acc - total / 2) < best) {
      best = Math.abs(acc - total / 2);
      k = i + 1;
    }
  }
  const share = sum(items.slice(0, k).map((i) => i.area)) / total;
  const [a, b] = rect.w >= rect.h
    ? [{ ...rect, w: rect.w * share }, { ...rect, x: rect.x + rect.w * share, w: rect.w * (1 - share) }]
    : [{ ...rect, h: rect.h * share }, { ...rect, y: rect.y + rect.h * share, h: rect.h * (1 - share) }];
  return [...split(items.slice(0, k), a), ...split(items.slice(k), b)];
}

function geometry(s) {
  const items = s.fields
    .map((f) => ({ id: f.id, area: f.areaHa * 10000 }))
    .sort((a, b) => b.area - a.area || (a.id < b.id ? -1 : 1));
  const total = Math.max(20000, sum(items.map((i) => i.area)));
  const bw = Math.sqrt(total * 1.4);
  const bh = total / bw;
  const pondR = Math.sqrt(s.config.pond.aMax / Math.PI);
  const side = Math.max(170, pondR * 2.6 + 70); // strip east of the fields: farmstead and pond
  const world = { x: -32, y: -62, w: 32 + bw + side + 8, h: 62 + bh + 34 };

  const parcels = split(items, { x: 0, y: 0, w: bw, h: bh }).map((p) => {
    // Pull each corner in a little, unevenly, so parcels get field margins and are not perfect boxes.
    const r = rand(`corner/${p.id}`);
    const j = () => 4 + r() * 4.5;
    const points = [
      [p.x + j(), p.y + j()], [p.x + p.w - j(), p.y + j()],
      [p.x + p.w - j(), p.y + p.h - j()], [p.x + j(), p.y + p.h - j()],
    ];
    return { ...p, points, cx: p.x + p.w / 2, cy: p.y + p.h / 2, angle: (p.w >= p.h ? 0 : 90) + (r() - 0.5) * 8 };
  });

  return {
    world, bw, bh, side, parcels,
    pond: { cx: bw + side * 0.54, cy: Math.max(pondR + 30, bh * 0.68), r: pondR },
    farm: { cx: bw + side * 0.5, cy: Math.min(bh * 0.2, bh * 0.68 - pondR - 75) },
  };
}

/** A closed, slightly uneven outline around a centre, for the pond. */
function blob(cx, cy, rx, ry, seed) {
  const r = rand(seed);
  const pts = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.9 + r() * 0.2;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M${mid(pts[n - 1], pts[0]).map(n1).join(' ')}`;
  for (let i = 0; i < n; i++) d += `Q${pts[i].map(n1).join(' ')} ${mid(pts[i], pts[(i + 1) % n]).map(n1).join(' ')}`;
  return `${d}Z`;
}

// --- Satellite photo -------------------------------------------------------
//
// When the farm has a location and its fields have boundaries (lat/lon rings,
// for example Jordbruksverket's jordbruksblock), the map lies on an aerial
// photo instead. Everything stays in metres around the farm, so pan, zoom,
// labels and the scale bar work the same as on the drawn map. Tiles are
// Web Mercator; over a farm the error of a flat projection is far below a metre.

const PHOTO = {
  // Prototype source. For production: Lantmäteriet's ortofoto (open data, free API key).
  // A page can point the tiles elsewhere (window.LIMNA_TILES), e.g. a preview that may not load other sites.
  url: (z, x, y) => globalThis.LIMNA_TILES?.(z, x, y)
    ?? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  credit: 'Bild: Esri, Maxar, Earthstar Geographics',
  zoom: 17,
};

function projector(lat0, lon0) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110574;
  return {
    toXY: ([lat, lon]) => [(lon - lon0) * kx, -(lat - lat0) * ky],
    toLatLon: ([x, y]) => [lat0 - y / ky, lon0 + x / kx],
  };
}

const tileLon = (x, z) => (x / 2 ** z) * 360 - 180;
const tileLat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
const lonTile = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latTile = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** Photo geometry, or null when the farm has no location or no field has a boundary. */
function photoGeometry(s) {
  const loc = s.config.farm.location;
  const withShape = s.config.fields.filter((f) => Array.isArray(f.polygon) && f.polygon.length >= 3);
  if (!loc || !withShape.length) return null;
  const pr = projector(loc.lat, loc.lon);

  const parcels = withShape.map((f) => {
    const points = f.polygon.map(pr.toXY);
    const xs = points.map((q) => q[0]);
    const ys = points.map((q) => q[1]);
    // Area-weighted centroid keeps the label inside an odd-shaped field.
    let a = 0; let cx = 0; let cy = 0;
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      const c = x0 * y1 - x1 * y0;
      a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    return { id: f.id, points, cx: cx / (3 * a), cy: cy / (3 * a), w: Math.max(...xs) - Math.min(...xs) };
  });
  const pondAt = s.config.pond.location ? pr.toXY(s.config.pond.location) : null;

  const all = parcels.flatMap((p) => p.points).concat(pondAt ? [pondAt] : []);
  const minX = Math.min(...all.map((q) => q[0])) - 40;
  const maxX = Math.max(...all.map((q) => q[0])) + 40;
  const minY = Math.min(...all.map((q) => q[1])) - 40;
  const maxY = Math.max(...all.map((q) => q[1])) + 40;
  const world = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  // A coarse layer wide enough that panning at the widest view never shows an edge,
  // and a sharp layer over the farm itself. About a hundred tiles in all.
  const tilesFor = (z, margin) => {
    const [north, west] = pr.toLatLon([world.x - margin, world.y - margin]);
    const [south, east] = pr.toLatLon([world.x + world.w + margin, world.y + world.h + margin]);
    const out = [];
    for (let ty = latTile(north, z); ty <= latTile(south, z); ty++) {
      for (let tx = lonTile(west, z); tx <= lonTile(east, z); tx++) {
        const [x0, y0] = pr.toXY([tileLat(ty, z), tileLon(tx, z)]);
        const [x1, y1] = pr.toXY([tileLat(ty + 1, z), tileLon(tx + 1, z)]);
        out.push({ href: PHOTO.url(z, tx, ty), x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
    return out;
  };
  const tiles = [
    ...tilesFor(PHOTO.zoom - 1, Math.max(world.w, world.h) * 0.6),
    ...tilesFor(PHOTO.zoom, 0),
  ];
  const missing = s.config.fields.length - withShape.length;
  return { world, parcels, pond: pondAt && { cx: pondAt[0], cy: pondAt[1] }, tiles, missing };
}

function photoLayer(g, s, ui) {
  const byId = new Map(s.fields.map((f) => [f.id, f]));
  const pts = (p) => p.points.map((q) => q.map(n1).join(',')).join(' ');
  // Half a pixel of overlap hides the seams between tiles.
  const tiles = g.tiles.map((t) => `<image href="${t.href}" x="${n1(t.x - 0.3)}" y="${n1(t.y - 0.3)}" width="${n1(t.w + 0.6)}" height="${n1(t.h + 0.6)}" preserveAspectRatio="none"/>`).join('');
  const parcels = g.parcels.map((p) => {
    const f = byId.get(p.id);
    return `<g class="map-field map-field--photo${ui.mapSelected === f.id ? ' is-selected' : ''}" data-map-id="${f.id}" tabindex="0" role="button"
        aria-label="${esc(f.name)}, ${esc(f.statusText.toLowerCase())}">
      <polygon points="${pts(p)}" fill="${needColour(f.status, f.deficit / f.raw)}" fill-opacity="0.42"/>
      <polygon class="map-edge" points="${pts(p)}"/>
    </g>`;
  }).join('');
  const pond = g.pond ? `<g class="map-pond map-pond--photo${ui.mapSelected === 'pond' ? ' is-selected' : ''}" data-map-id="pond" tabindex="0" role="button"
      aria-label="${esc(s.pond.name)}, ${fmt0(s.pond.usableShare * 100)} procent användbart vatten kvar">
      <circle cx="${n1(g.pond.cx)}" cy="${n1(g.pond.cy)}" r="16" fill="#3d8a81" fill-opacity="0.35"/>
      <circle class="map-edge" cx="${n1(g.pond.cx)}" cy="${n1(g.pond.cy)}" r="16"/>
      <circle cx="${n1(g.pond.cx)}" cy="${n1(g.pond.cy)}" r="3.5" fill="#e3c567" stroke="#1d4743" stroke-width="1"/>
    </g>` : '';
  const labels = g.parcels.map((p) => {
    const f = byId.get(p.id);
    return label(p.cx, p.cy, p.w, [f.name, f.statusText]);
  }).join('') + (g.pond ? label(g.pond.cx, g.pond.cy + 34, 120, ['Dammen', `${fmt0(s.pond.usableShare * 100)} % kvar`]) : '');
  const e = Math.max(g.world.w, g.world.h) * 0.9;
  return `<rect x="${n1(g.world.x - e)}" y="${n1(g.world.y - e)}" width="${n1(g.world.w + 2 * e)}" height="${n1(g.world.h + 2 * e)}" fill="#4c5a37"/>
    <g class="map-photo">${tiles}</g>${parcels}${pond}${labels}`;
}

// --- Drawing ---------------------------------------------------------------

function surroundings(g, seed) {
  const { world, bw, bh, side } = g;
  const r = rand(`land/${seed}`);
  const m = Math.max(world.w, world.h) * 0.8;
  const e = { x: world.x - m, y: world.y - m, w: world.w + 2 * m, h: world.h + 2 * m };
  let out = `<rect x="${n1(e.x)}" y="${n1(e.y)}" width="${n1(e.w)}" height="${n1(e.h)}" fill="${GROUND}"/>`;

  // Other people's fields, muted, on an uneven grid. The farm's own land is left clear.
  const cw = 196;
  const ch = 152;
  let i = 0;
  for (let y = e.y; y < e.y + e.h; y += ch) {
    for (let x = e.x + (r() - 0.5) * 60; x < e.x + e.w; x += cw) {
      const w = cw - 9 - r() * 12;
      const h = ch - 9 - r() * 12;
      const tone = NEIGHBOURS[Math.floor(r() * NEIGHBOURS.length)];
      i++;
      if (x + w > -34 && x < bw + side + 10 && y + h > -34 && y < bh + 34) continue;
      out += `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="3" fill="${tone}"/>`
        + `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="3" fill="url(#rows-n${i % 3})"/>`;
    }
  }

  // Road past the farm, the drive up to it and a track down to the pond.
  out += `<path class="map-road" d="M${n1(e.x)} -44Q${n1(bw / 2)} -22 ${n1(e.x + e.w)} -47"/>`
    + `<path class="map-track" d="M${n1(g.farm.cx)} ${n1(g.farm.cy)}L${n1(g.farm.cx + 6)} -34"/>`
    + `<path class="map-track map-track--thin" d="M${n1(g.farm.cx - 4)} ${n1(g.farm.cy)}Q${n1(g.farm.cx - 30)} ${n1((g.farm.cy + g.pond.cy) / 2)} ${n1(g.pond.cx - g.pond.r * 0.4)} ${n1(g.pond.cy - g.pond.r)}"/>`
    + `<path class="map-track map-track--thin" d="M-18 -30L-18 ${n1(bh + 18)}L${n1(bw + 14)} ${n1(bh + 18)}"/>`;

  // Woods: clumps of crowns, kept off the farm's own land.
  const crown = (x, y, rad) => {
    const tone = ['#22401f', '#2c5226', '#1b351a', '#335a2a'][Math.floor(r() * 4)];
    return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(rad)}" fill="${tone}"/>`
      + `<circle cx="${n1(x - rad * 0.25)}" cy="${n1(y - rad * 0.25)}" r="${n1(rad * 0.45)}" fill="#4a7a3a" opacity="0.35"/>`;
  };
  for (let c = 0; c < 11; c++) {
    const wx = e.x + r() * e.w;
    const wy = e.y + r() * e.h;
    const count = 16 + Math.floor(r() * 18);
    for (let t = 0; t < count; t++) {
      const x = wx + (r() + r() - 1) * 85;
      const y = wy + (r() + r() - 1) * 60;
      const rad = 6 + r() * 6;
      if (x > -30 && x < bw + side && y > -30 && y < bh + 30) continue;
      out += crown(x, y, rad);
    }
  }
  return { out, crown };
}

function farmstead(g, crown) {
  const { cx, cy } = g.farm;
  const building = (x, y, w, h, roof, turn) =>
    `<g transform="rotate(${turn} ${n1(cx + x + w / 2)} ${n1(cy + y + h / 2)})">`
    + `<rect x="${n1(cx + x + 2.5)}" y="${n1(cy + y + 2.5)}" width="${w}" height="${h}" fill="#000" opacity="0.3"/>`
    + `<rect x="${n1(cx + x)}" y="${n1(cy + y)}" width="${w}" height="${h}" fill="${roof}"/>`
    + `<line x1="${n1(cx + x)}" x2="${n1(cx + x + w)}" y1="${n1(cy + y + h / 2)}" y2="${n1(cy + y + h / 2)}" stroke="#000" stroke-opacity="0.18" stroke-width="0.8"/></g>`;
  return `<rect x="${n1(cx - 44)}" y="${n1(cy - 30)}" width="88" height="62" rx="9" fill="#a59c82"/>`
    + building(-36, -22, 34, 15, '#b8b3a7', -3)
    + building(8, -24, 15, 10, '#93402f', 4)
    + building(6, 2, 28, 13, '#8f948f', 2)
    + building(-34, 6, 20, 11, '#6b6f6a', -2)
    + [[-52, -28, 8], [-50, 16, 9], [50, -20, 8], [48, 22, 7], [-8, 38, 8], [24, -38, 7]]
      .map(([x, y, rad]) => crown(cx + x, cy + y, rad)).join('');
}

function pondShape(g, s, selected) {
  const { cx, cy, r } = g.pond;
  const p = s.pond;
  const water = Math.sqrt(Math.max(0.05, p.area / s.config.pond.aMax)); // water surface shrinks as the level drops
  return `<g class="map-pond${selected ? ' is-selected' : ''}" data-map-id="pond" tabindex="0" role="button"
      aria-label="${esc(p.name)}, ${fmt0(p.usableShare * 100)} procent användbart vatten kvar">
    <path d="${blob(cx, cy, r * 1.3, r * 0.82, 'bank')}" fill="#6f6b49"/>
    <path d="${blob(cx, cy, r * 1.3 * water, r * 0.82 * water, 'bank')}" fill="url(#map-water)"/>
    <path class="map-edge" d="${blob(cx, cy, r * 1.3, r * 0.82, 'bank')}"/>
    <circle cx="${n1(cx + r * 0.2)}" cy="${n1(cy - r * 0.1)}" r="3.200" fill="#e3c567" stroke="#1d4743" stroke-width="1"/>
  </g>`;
}

const label = (x, y, fit, lines, dy = 0) => {
  const nameWidth = lines[0].length * 6.9;
  return `<g class="map-lbl" data-x="${n1(x)}" data-y="${n1(y)}" data-fit="${n1(fit)}" data-name="${n1(nameWidth)}" transform="translate(${n1(x)} ${n1(y)})">
    <text class="map-lbl__name" y="${dy - 9}">${esc(lines[0])}</text>
    <text class="map-lbl__val" y="${dy + 6}">${esc(lines[1])}</text>
    ${lines[2] ? `<text class="map-lbl__sub" y="${dy + 20}">${esc(lines[2])}</text>` : ''}
  </g>`;
};

/** The drawn map: parcels laid out from the areas, with made-up surroundings. */
function drawnLayer(g, s, ui) {
  const byId = new Map(s.fields.map((f) => [f.id, f]));
  const land = surroundings(g, s.farm.id);
  const pts = (p) => p.points.map((q) => q.map(n1).join(',')).join(' ');
  const tone = (id) => needColour(byId.get(id).status, byId.get(id).deficit / byId.get(id).raw);

  const defs = `<defs>
    ${[0, 1, 2].map((i) => `<pattern id="rows-n${i}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(${[4, 92, 47][i]})"><rect width="7" height="1.600" fill="#000" opacity="0.13"/></pattern>`).join('')}
    ${g.parcels.map((p) => `<pattern id="rows-${p.id}" width="5.500" height="5.500" patternUnits="userSpaceOnUse" patternTransform="rotate(${n1(p.angle)})"><rect width="5.500" height="1.400" fill="#000" opacity="0.2"/></pattern>
      <radialGradient id="heat-${p.id}"><stop offset="0" stop-color="${tone(p.id)}" stop-opacity="0.84"/><stop offset="1" stop-color="${tone(p.id)}" stop-opacity="0.62"/></radialGradient>`).join('')}
    <radialGradient id="map-water"><stop offset="0" stop-color="#2a6d78"/><stop offset="1" stop-color="#163f4a"/></radialGradient>
  </defs>`;

  const parcels = g.parcels.map((p) => {
    const f = byId.get(p.id);
    return `<g class="map-field${ui.mapSelected === f.id ? ' is-selected' : ''}" data-map-id="${f.id}" tabindex="0" role="button"
        aria-label="${esc(f.name)}, ${esc(f.statusText.toLowerCase())}">
      <polygon points="${pts(p)}" fill="${TONES[f.cropId] || '#5a7a3c'}"/>
      <polygon points="${pts(p)}" fill="url(#rows-${p.id})"/>
      <polygon points="${pts(p)}" fill="url(#heat-${p.id})"/>
      <polygon class="map-edge" points="${pts(p)}"/>
    </g>`;
  }).join('');

  const labels = g.parcels.map((p) => {
    const f = byId.get(p.id);
    return label(p.cx, p.cy, p.w, [f.name, f.statusText]);
  }).join('') + label(g.pond.cx, g.pond.cy + g.pond.r * 0.9, g.pond.r * 3.4, ['Dammen', `${fmt0(s.pond.usableShare * 100)} % kvar`], 24);

  return `${defs}${land.out}
    <rect x="${n1(g.bw + 6)}" y="-26" width="${n1(g.side - 4)}" height="${n1(g.bh + 44)}" rx="14" fill="#56683c"/>
    ${farmstead(g, land.crown)}${pondShape(g, s, ui.mapSelected === 'pond')}${parcels}${labels}`;
}

/** The map card for the fields view: a satellite photo when the farm has boundaries, else a drawing. */
export function farmMap(s, ui) {
  const photo = photoGeometry(s);
  const usePhoto = Boolean(photo) && ui.mapView !== 'drawn';
  const g = usePhoto ? photo : geometry(s);

  const svg = `<svg viewBox="${n1(g.world.x)} ${n1(g.world.y)} ${n1(g.world.w)} ${n1(g.world.h)}" preserveAspectRatio="xMidYMid slice"
      role="group" aria-label="${usePhoto ? 'Satellitbild' : 'Ritad karta'} över gården. Fälten är färgade efter bevattningsbehov.">
    ${usePhoto ? photoLayer(g, s, ui) : drawnLayer(g, s, ui)}
  </svg>`;

  const toggle = photo ? seg('mapView', usePhoto ? 'photo' : 'drawn', [['photo', 'Satellit'], ['drawn', 'Ritad']]) : '';
  const missing = usePhoto && photo.missing
    ? `<p class="hint">${photo.missing === 1 ? 'Ett fält' : `${photo.missing} fält`} saknar gräns och syns bara på den ritade kartan.</p>` : '';

  return `<section class="card mapcard">
    <header class="card__head"><h2>${icon('map')}Fälten på kartan</h2>${toggle}</header>
    <div class="farmmap${usePhoto ? ' farmmap--photo' : ''}" data-map data-key="${usePhoto ? 'photo' : 'drawn'}-${n1(g.world.w)}x${n1(g.world.h)}" data-world="${[g.world.x, g.world.y, g.world.w, g.world.h].map(n1).join(' ')}">
      ${svg}
      <div class="farmmap__tools">
        <button type="button" data-map-zoom="in" aria-label="Zooma in">${icon('plus')}</button>
        <button type="button" data-map-zoom="out" aria-label="Zooma ut">${icon('minus')}</button>
        <button type="button" data-map-zoom="reset" aria-label="Visa hela gården">${icon('expand')}</button>
      </div>
      <div class="farmmap__scale" aria-hidden="true"><i></i><span></span></div>
      <span class="farmmap__note">${usePhoto ? PHOTO.credit : 'Ritad vy'}</span>
    </div>
    <ul class="maplegend">
      <li><i class="dot dot--bad" aria-hidden="true"></i>Vattna nu</li>
      <li><i class="dot dot--warn" aria-hidden="true"></i>Snart</li>
      <li><i class="dot dot--good" aria-hidden="true"></i>Bra</li>
    </ul>
    ${missing}
    ${mapInfo(s, ui)}
  </section>`;
}

const seg = (key, current, options) =>
  `<div class="seg seg--small" role="group" aria-label="Kartvy">${options
    .map(([value, text]) => `<button type="button" class="seg__btn" data-action="ui" data-key="${key}" data-value="${value}" aria-pressed="${value === current}">${text}</button>`)
    .join('')}</div>`;

/** What is shown under the map for the field or pond that has been tapped. */
function mapInfo(s, ui) {
  if (ui.mapSelected === 'pond') {
    const p = s.pond;
    const word = { ok: 'Bra', warn: 'Håll koll', bad: 'Åtgärd krävs' }[p.status];
    return `<div class="mapinfo">
      <div class="mapinfo__head"><b>${esc(p.name)}</b><span class="pill pill--${p.status}">${icon(p.status)}<span>${word}</span></span></div>
      <p>${fmtM3(p.usable)} m³ användbart vatten, ${fmt0(p.usableShare * 100)} % kvar. Nivå ${fmt2(p.level)} m.</p>
      <a class="btn btn--ghost" href="#/damm">Visa dammen ${icon('chevron')}</a>
    </div>`;
  }
  const f = s.fields.find((x) => x.id === ui.mapSelected);
  if (!f) {
    return `<div class="mapinfo mapinfo--empty">${icon('field')}<span>Tryck på ett fält för att se rådet.</span></div>`;
  }
  return `<div class="mapinfo">
    <div class="mapinfo__head"><b>${esc(f.name)}</b><span class="pill pill--${f.status}">${icon(f.status)}<span>${esc(f.statusText)}</span></span></div>
    <p class="muted">${esc(f.cropName)} · ${fmt1(f.areaHa)} ha · markfukt ${fmt1(f.theta * 100)} %, torrgräns ${fmt1(f.thetaDry * 100)} %</p>
    <p><b>${esc(f.advice.title)}.</b> ${esc(f.advice.reason)}</p>
    <a class="btn btn--ghost" href="#/aker/${f.id}">Visa fältet ${icon('chevron')}</a>
  </div>`;
}

// --- Pan, zoom and tap -----------------------------------------------------

/**
 * Makes the map in `root` live. `onSelect(id)` is called when a field or the
 * pond is tapped. Safe to call again after a re-render or a resize.
 */
export function mountMap(root, onSelect) {
  const box = root.querySelector('[data-map]');
  if (!box) return;
  const svg = box.querySelector('svg');
  const [wx, wy, ww, wh] = box.dataset.world.split(' ').map(Number);
  const width = box.clientWidth;
  const height = box.clientHeight;
  if (!width || !height) return;

  // The widest view: the farm, grown to the shape of the box.
  const grow = Math.max((width / height) / (ww / wh), 1);
  const base = { w: ww * grow, h: (ww * grow * height) / width };
  if (base.h < wh) {
    base.h = wh;
    base.w = (wh * width) / height;
  }
  base.x = wx + ww / 2 - base.w / 2;
  base.y = wy + wh / 2 - base.h / 2;

  if (view.key !== box.dataset.key) {
    Object.assign(view, { key: box.dataset.key, zoom: 1, cx: wx + ww / 2, cy: wy + wh / 2 });
  }

  const labels = [...svg.querySelectorAll('.map-lbl')];
  const scaleBar = box.querySelector('.farmmap__scale i');
  const scaleText = box.querySelector('.farmmap__scale span');

  const apply = () => {
    view.zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom));
    const w = base.w / view.zoom;
    const h = base.h / view.zoom;
    view.cx = Math.min(base.x + base.w - w / 2, Math.max(base.x + w / 2, view.cx));
    view.cy = Math.min(base.y + base.h - h / 2, Math.max(base.y + h / 2, view.cy));
    svg.setAttribute('viewBox', `${n1(view.cx - w / 2)} ${n1(view.cy - h / 2)} ${n1(w)} ${n1(h)}`);

    // Labels keep their size on screen. A name that does not fit its field is left out until zoomed in.
    const k = w / width; // metres per pixel
    for (const el of labels) {
      const fitPx = Number(el.dataset.fit) / k;
      el.setAttribute('transform', `translate(${el.dataset.x} ${el.dataset.y}) scale(${k.toFixed(4)})`);
      el.classList.toggle('is-compact', fitPx < Number(el.dataset.name) + 12);
      el.classList.toggle('is-hidden', fitPx < 38);
    }
    const metres = [10, 20, 50, 100, 200, 500].find((m) => m / k >= 56) || 500;
    scaleBar.style.width = `${Math.round(metres / k)}px`;
    scaleText.textContent = `${metres} m`;
  };

  const toWorld = (clientX, clientY) => {
    const rect = box.getBoundingClientRect();
    const k = base.w / view.zoom / width;
    return [view.cx + (clientX - rect.left - width / 2) * k, view.cy + (clientY - rect.top - height / 2) * k];
  };
  const zoomAt = (factor, clientX, clientY) => {
    const rect = box.getBoundingClientRect();
    const [x, y] = toWorld(clientX ?? rect.left + width / 2, clientY ?? rect.top + height / 2);
    const before = view.zoom;
    view.zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom * factor));
    const ratio = before / view.zoom;
    view.cx = x + (view.cx - x) * ratio;
    view.cy = y + (view.cy - y) * ratio;
    apply();
  };

  const pointers = new Map();
  let moved = 0;
  let pinch = 0;

  svg.onpointerdown = (ev) => {
    pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pointers.size === 1) moved = 0;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    svg.setPointerCapture(ev.pointerId);
  };
  svg.onpointermove = (ev) => {
    const last = pointers.get(ev.pointerId);
    if (!last) return;
    const dx = ev.clientX - last[0];
    const dy = ev.clientY - last[1];
    pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
    moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 1) {
      if (moved < 6) return;
      const k = base.w / view.zoom / width;
      view.cx -= dx * k;
      view.cy -= dy * k;
      apply();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) zoomAt(dist / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      pinch = dist;
    }
  };
  const release = (ev) => {
    const wasTap = pointers.size === 1 && pointers.has(ev.pointerId) && moved < 6 && ev.type === 'pointerup';
    pointers.delete(ev.pointerId);
    pinch = 0;
    if (!wasTap) return;
    const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-map-id]');
    onSelect(hit && box.contains(hit) ? hit.dataset.mapId : null);
  };
  svg.onpointerup = release;
  svg.onpointercancel = release;
  svg.ondblclick = (ev) => zoomAt(1.8, ev.clientX, ev.clientY);
  svg.onkeydown = (ev) => {
    const target = ev.target.closest('[data-map-id]');
    if (target && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      onSelect(target.dataset.mapId);
    }
  };
  // Pinch on a trackpad arrives as ctrl + wheel. Plain scrolling is left to the page.
  svg.onwheel = (ev) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    zoomAt(Math.exp(-ev.deltaY * 0.01), ev.clientX, ev.clientY);
  };
  box.querySelectorAll('[data-map-zoom]').forEach((button) => {
    button.onclick = () => {
      if (button.dataset.mapZoom === 'reset') {
        Object.assign(view, { zoom: 1, cx: wx + ww / 2, cy: wy + wh / 2 });
        apply();
      } else {
        zoomAt(button.dataset.mapZoom === 'in' ? 1.6 : 1 / 1.6);
      }
    };
  });

  apply();
}
