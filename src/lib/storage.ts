import { LANGUAGES, type LanguageCode } from './languages';
import { getItem, setItem } from './localStore';

export interface Settings {
  from: LanguageCode;
  to: LanguageCode;
  pauseSeconds: number;
  repeatOriginal: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  from: 'deu',
  to: 'eng',
  pauseSeconds: 1,
  repeatOriginal: true,
};

const STORAGE_KEY = 'listen2bea.settings.v1';

const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && value in LANGUAGES;

export function loadSettings(): Settings {
  try {
    const raw = getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<Settings>;
    const pauseSeconds = Number(parsed.pauseSeconds);

    return {
      from: isLanguageCode(parsed.from) ? parsed.from : DEFAULT_SETTINGS.from,
      to: isLanguageCode(parsed.to) ? parsed.to : DEFAULT_SETTINGS.to,
      pauseSeconds: Number.isFinite(pauseSeconds)
        ? Math.min(5, Math.max(1, Math.round(pauseSeconds)))
        : DEFAULT_SETTINGS.pauseSeconds,
      repeatOriginal:
        typeof parsed.repeatOriginal === 'boolean'
          ? parsed.repeatOriginal
          : DEFAULT_SETTINGS.repeatOriginal,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Settings are optional; ignore serialization failures.
  }
}
