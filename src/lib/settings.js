// User preferences, persisted to localStorage.
//
// This is intentionally a plain JS module (not a React context) so the math
// solvers can read preferences without any dependency on React. It degrades
// to defaults when localStorage is unavailable (e.g. under `node --test`).

const STORAGE_KEY = 'mastermath-settings';

export const ANGLE_UNITS = ['auto', 'degrees', 'radians'];
export const DECIMAL_PLACES_MIN = 2;
export const DECIMAL_PLACES_MAX = 6;

// The angles Auto reads as degrees when typed bare: sin(30) is sin(30°).
// Shared by the trig solver and the input's note, which says so before the
// solve (1.65.0 review).
export const COMMON_DEGREE_VALUES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];

// The bare common angle Auto will read as degrees in this input, or null:
// "sin(30)" → 30; "sin(30°)", "sin(pi/6)", "sin(1)" → null.
export function autoDegreeAngle(text) {
  if (/pi|π|°/i.test(String(text))) return null;
  const m = String(text).match(/(?<![a-z])(?:sin|cos|tan|sec|csc|cot)\s*\(?\s*(-?\d+)\s*\)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n !== 0 && COMMON_DEGREE_VALUES.includes(Math.abs(n)) ? n : null;
}

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

// Settings handed in by message rather than read from storage. The solver
// worker has no localStorage; the page sends the current settings with every
// solve request and the worker primes them here before solving.
let primed = null;

export function primeSettings(settings) {
  primed = settings ? sanitize(settings) : null;
}

export function getSettings() {
  if (primed) return { ...primed };
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
