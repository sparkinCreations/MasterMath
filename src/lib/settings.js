// User preferences, persisted to localStorage.
//
// This is intentionally a plain JS module (not a React context) so the math
// solvers can read preferences without any dependency on React. It degrades
// to defaults when localStorage is unavailable (e.g. under `node --test`).

const STORAGE_KEY = 'mastermath-settings';

export const ANGLE_UNITS = ['auto', 'degrees', 'radians'];
export const DECIMAL_PLACES_MIN = 2;
export const DECIMAL_PLACES_MAX = 6;

export const DEFAULT_SETTINGS = Object.freeze({
  // 'auto' keeps the historical heuristic: bare common angles like sin(30)
  // are treated as degrees, anything with pi as radians.
  angleUnit: 'auto',
  decimalPlaces: 4,
});

function sanitize(settings) {
  const out = { ...DEFAULT_SETTINGS, ...settings };

  if (!ANGLE_UNITS.includes(out.angleUnit)) {
    out.angleUnit = DEFAULT_SETTINGS.angleUnit;
  }

  const places = Math.round(Number(out.decimalPlaces));
  out.decimalPlaces = Number.isFinite(places)
    ? Math.min(DECIMAL_PLACES_MAX, Math.max(DECIMAL_PLACES_MIN, places))
    : DEFAULT_SETTINGS.decimalPlaces;

  return out;
}

export function getSettings() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial) {
  const merged = sanitize({ ...getSettings(), ...partial });

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Storage full or blocked — settings just won't persist this session.
    }
  }

  return merged;
}

export function resetSettings() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_SETTINGS };
}
