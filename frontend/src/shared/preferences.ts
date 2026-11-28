import { useSyncExternalStore } from 'react';

const preferenceEvent = 'devtrail-preferences';
const prefix = 'devtrail.';
export type Theme = 'light' | 'dark' | 'system';

function subscribe(listener: () => void) {
  window.addEventListener(preferenceEvent, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(preferenceEvent, listener);
    window.removeEventListener('storage', listener);
  };
}

function read(key: string) {
  try { return window.localStorage.getItem(prefix + key); } catch { return null; }
}

export function readTheme(): Theme {
  const value = read('theme');
  return value === 'dark' || value === 'light' ? value : 'system';
}

export function applyTheme() {
  document.documentElement.dataset.theme = readTheme();
}

export function usePreference<T extends string>(key: string, readValue: () => T) {
  const value = useSyncExternalStore(subscribe, readValue);
  return [value, (next: T) => {
    try { window.localStorage.setItem(prefix + key, next); } catch { return; }
    applyTheme();
    window.dispatchEvent(new Event(preferenceEvent));
  }] as const;
}

export function initializeTheme() {
  applyTheme();
  window.addEventListener('storage', applyTheme);
}
