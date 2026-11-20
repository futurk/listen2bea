export const LANGUAGES = {
  deu: 'German',
  eng: 'English',
  fra: 'French',
  spa: 'Spanish',
  ita: 'Italian',
  jpn: 'Japanese',
  tur: 'Turkish',
  rus: 'Russian',
  ara: 'Arabic',
  cmn: 'Chinese (Mandarin)',
  por: 'Portuguese',
  hun: 'Hungarian',
  heb: 'Hebrew',
  nld: 'Dutch',
  ukr: 'Ukrainian',
  pol: 'Polish',
  vie: 'Vietnamese',
  kor: 'Korean',
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export interface LanguageOption {
  code: LanguageCode;
  name: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = (
  Object.keys(LANGUAGES) as LanguageCode[]
).map((code) => ({ code, name: LANGUAGES[code] }));
