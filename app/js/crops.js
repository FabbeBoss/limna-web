// Crop and soil tables. Starting values, meant to be calibrated per farm.
//
// kc:      [initial, mid-season, end] crop coefficients (FAO-56, table 12)
// stages:  length in days of [initial, development, mid-season, late] (FAO-56, table 11)
// rootMax: maximum effective rooting depth in metres (FAO-56, table 22)
// p:       depletion fraction, the share of TAW the crop can use without stress (FAO-56, table 22)
// ky:      yield response factor (FAO-33)
// seasonEtc: typical crop water use over a whole season, mm. Used to put a
//            short dry spell in proportion to the season when estimating yield loss.
// yieldTHa / priceKrT: example yield and price, overridden per field and by the price source.

export const CROPS = {
  potatis: {
    name: 'Potatis', kc: [0.5, 1.15, 0.75], stages: [25, 30, 45, 30],
    rootMax: 0.5, p: 0.35, ky: 1.1, seasonEtc: 450, yieldTHa: 40, priceKrT: 2600, irrigated: true,
  },
  varkorn: {
    name: 'Vårkorn', kc: [0.3, 1.15, 0.25], stages: [20, 25, 60, 30],
    rootMax: 1.0, p: 0.55, ky: 1.15, seasonEtc: 400, yieldTHa: 5.5, priceKrT: 1900, irrigated: false,
  },
  hostvete: {
    name: 'Höstvete', kc: [0.7, 1.15, 0.25], stages: [160, 75, 75, 25],
    rootMax: 1.5, p: 0.55, ky: 1.05, seasonEtc: 480, yieldTHa: 7.5, priceKrT: 2200, irrigated: false,
  },
  raps: {
    name: 'Raps (vårsådd)', kc: [0.35, 1.1, 0.35], stages: [25, 35, 45, 25],
    rootMax: 1.0, p: 0.6, ky: 1.0, seasonEtc: 400, yieldTHa: 2.5, priceKrT: 5200, irrigated: false,
  },
  sockerbetor: {
    name: 'Sockerbetor', kc: [0.35, 1.2, 0.7], stages: [50, 40, 50, 40],
    rootMax: 1.0, p: 0.55, ky: 1.0, seasonEtc: 550, yieldTHa: 70, priceKrT: 480, irrigated: true,
  },
  gronsaker: {
    name: 'Grönsaker (morot)', kc: [0.7, 1.05, 0.95], stages: [30, 40, 60, 20],
    rootMax: 0.5, p: 0.35, ky: 1.0, seasonEtc: 400, yieldTHa: 55, priceKrT: 3200, irrigated: true,
  },
};

export const STAGE_NAMES = ['Etablering', 'Tillväxt', 'Full utveckling', 'Mognad', 'Skördemogen'];

// Volumetric water content at field capacity (fc) and wilting point (wp), m³/m³.
// Mid-range values per texture class from FAO-56, table 19.
export const SOILS = {
  sand: { name: 'Sand', fc: 0.12, wp: 0.045 },
  mo: { name: 'Mo', fc: 0.20, wp: 0.07 },
  lattlera: { name: 'Lättlera', fc: 0.29, wp: 0.13 },
  mellanlera: { name: 'Mellanlera', fc: 0.36, wp: 0.20 },
  styvlera: { name: 'Styv lera', fc: 0.42, wp: 0.27 },
  mull: { name: 'Mulljord', fc: 0.45, wp: 0.20 },
};
