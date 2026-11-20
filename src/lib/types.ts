export interface Audio {
  id: number;
  author: string;
  license?: string;
  attribution_url?: string;
  download_url?: string;
  created?: string | null;
  modified?: string | null;
}

export interface Translation {
  id: number;
  text: string;
  lang: string;
  is_direct: boolean;
  owner?: string | null;
  audios?: Audio[];
}

export interface Sentence {
  id: number;
  text: string;
  lang: string;
  owner?: string | null;
  audios?: Audio[];
  translations: Translation[];
}

export interface Paging {
  total: number;
  has_next: boolean;
  next?: string;
  first?: string;
}

export interface SentenceSearchResponse {
  data: Sentence[];
  paging: Paging;
}

/** A translation whose audio is safe to play. */
export interface PlayableTranslation extends Omit<Translation, 'audios'> {
  audios: Audio[];
}

/** A sentence whose own audio and translations are safe to play. */
export interface PlayableSentence extends Omit<Sentence, 'audios' | 'translations'> {
  audios: Audio[];
  translations: PlayableTranslation[];
}

export interface SentencePage {
  sentences: PlayableSentence[];
  next: string | null;
}
