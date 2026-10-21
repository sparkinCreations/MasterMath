import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { readThemePreference, writeThemePreference, resolveIsDark, systemPrefersDark, DARK_QUERY } from '@/lib/theme';

const DarkModeContext = createContext();

// Theme: 'system' | 'light' | 'dark' (see lib/theme.js). `isDarkMode` is the
// resolved value every component reads; in system mode it follows the
// OS/browser setting live. The inline boot script in index.html applies the
// same resolution before first paint, so there is no flash of the wrong
// theme on load; this provider then owns the class from mount on.
export function DarkModeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readThemePreference(globalThis.localStorage));
  const [systemDark, setSystemDark] = useState(() => systemPrefersDark());

  // Follow the system setting while it is the preference.
  useEffect(() => {
    const query = globalThis.matchMedia?.(DARK_QUERY);
    if (!query) return undefined;
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const isDarkMode = resolveIsDark(theme, systemDark);

  useEffect(() => {
    writeThemePreference(globalThis.localStorage, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const setTheme = useCallback((next) => setThemeState(next), []);
  // The header's one-button toggle: pick the opposite of what is showing,
  // as an explicit choice (leaving system mode).
  const toggleDarkMode = useCallback(() => setThemeState(isDarkMode ? 'light' : 'dark'), [isDarkMode]);

  const value = useMemo(() => ({ isDarkMode, theme, setTheme, toggleDarkMode }), [isDarkMode, theme, setTheme, toggleDarkMode]);
  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }
  return context;
}
