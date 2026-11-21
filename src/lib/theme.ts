import { useColorScheme } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export interface AppTheme {
  scheme: ColorScheme;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  subtleBorder: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentSoft: string;
  danger: string;
  success: string;
  inputBackground: string;
  tooltipBackground: string;
  tooltipText: string;
  overlay: string;
}

export const lightTheme: AppTheme = {
  scheme: 'light',
  background: '#ffffff',
  surface: '#ffffff',
  text: '#111111',
  textMuted: '#666666',
  border: '#111111',
  subtleBorder: '#dddddd',
  primary: '#111111',
  primaryText: '#ffffff',
  accent: '#1a6ed8',
  accentSoft: '#e8f0fe',
  danger: '#b00020',
  success: '#0a7a2f',
  inputBackground: '#ffffff',
  tooltipBackground: '#111111',
  tooltipText: '#ffffff',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

export const darkTheme: AppTheme = {
  scheme: 'dark',
  background: '#0f0f10',
  surface: '#1b1b1d',
  text: '#f2f2f2',
  textMuted: '#a1a1a6',
  border: '#f2f2f2',
  subtleBorder: '#3a3a3c',
  primary: '#f2f2f2',
  primaryText: '#111111',
  accent: '#7ab0ff',
  accentSoft: '#193352',
  danger: '#ff6b6b',
  success: '#6fcf97',
  inputBackground: '#151517',
  tooltipBackground: '#f2f2f2',
  tooltipText: '#111111',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
