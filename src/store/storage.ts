import type { Grammar, Vocabulary, Sentence, SRSFields } from '../types';

const STORAGE_KEYS = {
  grammar: 'jfbp_grammar',
  vocab: 'jfbp_vocab',
  sentences: 'jfbp_sentences',
} as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSRS(): SRSFields {
  return {
    nextReviewAt: todayISO(),
    interval: 0,
    easeFactor: 2.5,
  };
}

export function getGrammar(): Grammar[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.grammar);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getVocab(): Vocabulary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.vocab);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSentences(): Sentence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sentences);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGrammar(items: Grammar[]): void {
  localStorage.setItem(STORAGE_KEYS.grammar, JSON.stringify(items));
}

export function saveVocab(items: Vocabulary[]): void {
  localStorage.setItem(STORAGE_KEYS.vocab, JSON.stringify(items));
}

export function saveSentences(items: Sentence[]): void {
  localStorage.setItem(STORAGE_KEYS.sentences, JSON.stringify(items));
}

export function createGrammar(partial: Omit<Grammar, 'id' | 'type' | 'created' | 'srs'>): Grammar {
  const g: Grammar = {
    ...partial,
    id: crypto.randomUUID(),
    type: 'grammar',
    created: new Date().toISOString(),
    srs: defaultSRS(),
  };
  const list = getGrammar();
  list.push(g);
  saveGrammar(list);
  return g;
}

export function createVocab(partial: Omit<Vocabulary, 'id' | 'type' | 'created' | 'srs'>): Vocabulary {
  const v: Vocabulary = {
    ...partial,
    id: crypto.randomUUID(),
    type: 'vocab',
    created: new Date().toISOString(),
    srs: defaultSRS(),
  };
  const list = getVocab();
  list.push(v);
  saveVocab(list);
  return v;
}

export function createSentence(partial: Omit<Sentence, 'id' | 'type' | 'created' | 'srs'>): Sentence {
  const s: Sentence = {
    ...partial,
    id: crypto.randomUUID(),
    type: 'sentence',
    created: new Date().toISOString(),
    srs: defaultSRS(),
  };
  const list = getSentences();
  list.push(s);
  saveSentences(list);
  return s;
}

export function updateGrammar(id: string, updates: Partial<Grammar>): void {
  const list = getGrammar().map((g) => (g.id === id ? { ...g, ...updates } : g));
  saveGrammar(list);
}

export function updateVocab(id: string, updates: Partial<Vocabulary>): void {
  const list = getVocab().map((v) => (v.id === id ? { ...v, ...updates } : v));
  saveVocab(list);
}

export function updateSentence(id: string, updates: Partial<Sentence>): void {
  const list = getSentences().map((s) => (s.id === id ? { ...s, ...updates } : s));
  saveSentences(list);
}

export function deleteGrammar(id: string): void {
  saveGrammar(getGrammar().filter((g) => g.id !== id));
}

export function deleteVocab(id: string): void {
  saveVocab(getVocab().filter((v) => v.id !== id));
}

export function deleteSentence(id: string): void {
  saveSentences(getSentences().filter((s) => s.id !== id));
}

// Bulk add with default SRS
export function addGrammarBulk(items: Omit<Grammar, 'id' | 'type' | 'created' | 'srs'>[]): Grammar[] {
  const created = items.map((partial) => ({
    ...partial,
    id: crypto.randomUUID(),
    type: 'grammar' as const,
    created: new Date().toISOString(),
    srs: defaultSRS(),
  }));
  const list = getGrammar();
  list.push(...created);
  saveGrammar(list);
  return created;
}

export function addVocabBulk(items: Omit<Vocabulary, 'id' | 'type' | 'created' | 'srs'>[]): Vocabulary[] {
  const created = items.map((partial) => ({
    ...partial,
    id: crypto.randomUUID(),
    type: 'vocab' as const,
    created: new Date().toISOString(),
    srs: defaultSRS(),
  }));
  const list = getVocab();
  list.push(...created);
  saveVocab(list);
  return created;
}

export function addSentencesBulk(items: Omit<Sentence, 'id' | 'type' | 'created' | 'srs'>[]): Sentence[] {
  const created = items.map((partial) => ({
    ...partial,
    id: crypto.randomUUID(),
    type: 'sentence' as const,
    created: new Date().toISOString(),
    srs: defaultSRS(),
  }));
  const list = getSentences();
  list.push(...created);
  saveSentences(list);
  return created;
}
