import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '@/lib/storage';

let cached: Settings | null = null;
const listeners = new Set<() => void>();

const getSnapshot = (): Settings => {
  if (!cached) {
    cached = loadSettings();
  }
  return cached;
};

const getServerSnapshot = (): Settings => DEFAULT_SETTINGS;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const writeSettings = (next: Settings) => {
  cached = next;
  saveSettings(next);
  listeners.forEach((listener) => listener());
};

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    writeSettings({ ...getSnapshot(), [key]: value });
  }, []);

  return { settings, update };
}
