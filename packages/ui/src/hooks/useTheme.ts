import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ThemeMode } from '../types/index.ts';

const THEME_KEY = 'agentic-bunshin-theme';

function getStoredTheme(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_KEY);
  return (['system', 'dark', 'light'].includes(stored ?? '') ? stored : 'system') as ThemeMode;
}

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'dark' || mode === 'light') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribeToTheme(callback: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSnapshot(): ThemeMode {
  return getStoredTheme();
}

export function useTheme() {
  const themeMode = useSyncExternalStore(subscribeToTheme, getSnapshot);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    window.localStorage.setItem(THEME_KEY, mode);
    window.dispatchEvent(new Event('storage'));
  }, []);

  useEffect(() => {
    const resolved = resolveTheme(themeMode);
    document.body.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [themeMode]);

  const cycleTheme = useCallback(() => {
    const modes: ThemeMode[] = ['system', 'dark', 'light'];
    const idx = modes.indexOf(themeMode);
    setThemeMode(modes[(idx + 1) % modes.length]);
  }, [themeMode, setThemeMode]);

  return { themeMode, setThemeMode, cycleTheme, resolvedTheme: resolveTheme(themeMode) };
}
