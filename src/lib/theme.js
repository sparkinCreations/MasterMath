// Theme preference: 'system' (follow the OS / browser setting), 'light' or
// 'dark'. Pure functions so the resolution and the migration can be unit
// tested; the same logic is repeated, in miniature, in the inline boot
// script in index.html so the right class is on <html> before first paint.
//
// Storage: `theme` holds the preference. Before 1.42.0 a boolean `darkMode`
// held an explicit light/dark choice; it is read once when `theme` is absent
// so nobody who chose dark is switched back, and new visitors start on
// 'system'.

export const THEME_KEY = 'theme';
export const LEGACY_KEY = 'darkMode';
export const THEMES = ['system', 'light', 'dark'];
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readThemePreference(storage) {
  try {
    const stored = storage?.getItem(THEME_KEY);
    if (THEMES.includes(stored)) return stored;
    const legacy = storage?.getItem(LEGACY_KEY);
    if (legacy === 'true') return 'dark';
    if (legacy === 'false') return 'light';
  } catch {
    // storage unavailable (private mode, disabled): follow the system
  }
  return 'system';
}

export function writeThemePreference(storage, theme) {
  if (!THEMES.includes(theme)) throw new Error(`Unknown theme: ${theme}`);
  try {
    storage?.setItem(THEME_KEY, theme);
    storage?.removeItem(LEGACY_KEY);
  } catch {
    // nothing to persist to; the choice still applies for this page
  }
}

// Whether the page should be dark for this preference and system setting.
export function resolveIsDark(theme, systemPrefersDark) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return Boolean(systemPrefersDark);
}

// The OS / browser setting, or false where matchMedia is unavailable.
export function systemPrefersDark(win = globalThis) {
  try {
    return Boolean(win.matchMedia?.(DARK_QUERY)?.matches);
  } catch {
    return false;
  }
}
