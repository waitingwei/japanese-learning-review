// SRS fields used for flashcards
export interface SRSFields {
  nextReviewAt: string; // ISO date
  interval: number;
  easeFactor: number;
}

export interface Grammar {
  id: string;
  type: 'grammar';
  title: string;
  explanation: string;
  exampleSentence: string;
  exampleTranslation: string;
  lesson: string;
  created: string;
  srs?: SRSFields;
}

/** Verb conjugation forms stored with a vocabulary item (all optional, user or lookup filled). */
export interface VerbConjugation {
  present?: string;
  negative?: string;
  past?: string;
  pastNegative?: string;
  teForm?: string;
  taiForm?: string;
}

export interface Vocabulary {
  id: string;
  type: 'vocab';
  word: string;
  reading: string;
  meaning: string;
  exampleSentence: string;
  lesson: string;
  created: string;
  conjugationSummary?: string;
  /** Six conjugation form fields: Present, Negative, Past, Past Negative, Te-form, Tai-form. */
  conjugation?: VerbConjugation;
  srs?: SRSFields;
}

export interface Sentence {
  id: string;
  type: 'sentence';
  japaneseText: string;
  translation: string;
  linkedGrammar?: string;
  lesson: string;
  created: string;
  srs?: SRSFields;
}

export type ItemType = 'grammar' | 'vocab' | 'sentence';
export type Item = Grammar | Vocabulary | Sentence;

export function isGrammar(item: Item): item is Grammar {
  return item.type === 'grammar';
}
export function isVocabulary(item: Item): item is Vocabulary {
  return item.type === 'vocab';
}
export function isSentence(item: Item): item is Sentence {
  return item.type === 'sentence';
}
