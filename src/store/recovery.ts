/**
 * Recovery store: prevents data loss when the server returns or persists empty content.
 * - Saves a full snapshot after every successful API load (last-known-good backup).
 * - Saves the payload before every create/update so we can restore if the server drops it.
 * Only active when VITE_USE_API=true (API mode). Uses localStorage.
 */
import type { Grammar, Vocabulary, Sentence } from '../types';

const PREFIX = 'jfbp_recovery_';
const BACKUP_GRAMMAR = PREFIX + 'backup_grammar';
const BACKUP_VOCAB = PREFIX + 'backup_vocab';
const BACKUP_SENTENCES = PREFIX + 'backup_sentences';
const LAST_SENT_UPDATE = PREFIX + 'last_update_';
const LAST_SENT_CREATE = PREFIX + 'last_create_';
const LAST_SENT_BULK = PREFIX + 'last_bulk_';
const RECOVERED_IDS = PREFIX + 'recovered_ids';

function useRecovery(): boolean {
  if (typeof window === 'undefined') return false;
  const v = import.meta.env.VITE_USE_API;
  return v === 'true' || v === true;
}

function getRecoveredSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(RECOVERED_IDS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addRecovered(key: string): void {
  if (!useRecovery()) return;
  try {
    const set = getRecoveredSet();
    set.add(key);
    localStorage.setItem(RECOVERED_IDS, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function saveBackup(grammar: Grammar[], vocab: Vocabulary[], sentences: Sentence[]): void {
  if (!useRecovery()) return;
  try {
    localStorage.setItem(BACKUP_GRAMMAR, JSON.stringify(grammar));
    localStorage.setItem(BACKUP_VOCAB, JSON.stringify(vocab));
    localStorage.setItem(BACKUP_SENTENCES, JSON.stringify(sentences));
  } catch {
    // quota or disabled
  }
}

export function getBackup(): { grammar: Grammar[]; vocab: Vocabulary[]; sentences: Sentence[] } | null {
  if (typeof window === 'undefined') return null;
  try {
    const g = localStorage.getItem(BACKUP_GRAMMAR);
    const v = localStorage.getItem(BACKUP_VOCAB);
    const s = localStorage.getItem(BACKUP_SENTENCES);
    if (!g || !v || !s) return null;
    return {
      grammar: JSON.parse(g),
      vocab: JSON.parse(v),
      sentences: JSON.parse(s),
    };
  } catch {
    return null;
  }
}

function getBackupItem(type: 'grammar' | 'vocab' | 'sentence', id: string): Grammar | Vocabulary | Sentence | null {
  const backup = getBackup();
  if (!backup) return null;
  const list = type === 'grammar' ? backup.grammar : type === 'vocab' ? backup.vocab : backup.sentences;
  const n = normId(id);
  return list.find((x) => normId(x.id) === n) ?? list.find((x) => x.id === id) ?? null;
}

function normId(id: string): string {
  return String(id ?? '').trim().toLowerCase();
}

/** Save payload we're about to send for update so we can restore if server loses it. */
export function saveLastSentUpdate(
  type: 'grammar' | 'vocab' | 'sentence',
  id: string,
  payload: Record<string, unknown>
): void {
  if (!useRecovery()) return;
  try {
    localStorage.setItem(LAST_SENT_UPDATE + type + '_' + normId(id), JSON.stringify({ payload, at: Date.now() }));
  } catch {
    // ignore
  }
}

/** Save payload we're about to send for create (no id yet). */
export function saveLastSentCreate(
  type: 'grammar' | 'vocab' | 'sentence',
  payload: Record<string, unknown>
): void {
  if (!useRecovery()) return;
  try {
    localStorage.setItem(LAST_SENT_CREATE + type, JSON.stringify({ payload, at: Date.now() }));
  } catch {
    // ignore
  }
}

/** Save payloads we're about to send for bulk create so we can restore if server returns empty items. */
export function saveLastSentBulk(
  type: 'grammar' | 'vocab' | 'sentence',
  payloads: Record<string, unknown>[]
): void {
  if (!useRecovery() || payloads.length === 0) return;
  try {
    localStorage.setItem(LAST_SENT_BULK + type, JSON.stringify({ payloads, at: Date.now() }));
  } catch {
    // ignore
  }
}

function getLastSentBulk(type: 'grammar' | 'vocab' | 'sentence'): { payloads: Record<string, unknown>[]; at: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_SENT_BULK + type);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const payloads = Array.isArray(data?.payloads) ? data.payloads : [];
    return payloads.length > 0 ? { payloads, at: Number(data.at) || 0 } : null;
  } catch {
    return null;
  }
}

function getLastSentUpdate(type: 'grammar' | 'vocab' | 'sentence', id: string): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = LAST_SENT_UPDATE + type + '_' + normId(id);
    let raw = localStorage.getItem(key);
    if (!raw) raw = localStorage.getItem(LAST_SENT_UPDATE + type + '_' + id);
    if (!raw) return null;
    const { payload } = JSON.parse(raw);
    return payload ?? null;
  } catch {
    return null;
  }
}

/** Last create payload (no id yet). Used to restore the most recent empty item of that type. */
function getLastSentCreate(type: 'grammar' | 'vocab' | 'sentence'): { payload: Record<string, unknown>; at: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_SENT_CREATE + type);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.payload ? { payload: data.payload, at: Number(data.at) || 0 } : null;
  } catch {
    return null;
  }
}

/** Clear last-sent for an id after successful recovery so we don't keep restoring. */
export function clearLastSentUpdate(type: 'grammar' | 'vocab' | 'sentence', id: string): void {
  if (!useRecovery()) return;
  try {
    localStorage.removeItem(LAST_SENT_UPDATE + type + '_' + normId(id));
    localStorage.removeItem(LAST_SENT_UPDATE + type + '_' + id);
  } catch {
    // ignore
  }
}

/** Treat placeholder or whitespace-only as empty so we attempt recovery. */
function hasContent(item: Grammar | Vocabulary | Sentence): boolean {
  const notEmpty = (s: string | undefined): boolean => {
    const t = (s ?? '').toString().trim()
    return t.length > 0 && t !== '?'
  }
  if (item.type === 'grammar') return notEmpty((item as Grammar).title)
  if (item.type === 'vocab') return notEmpty((item as Vocabulary).word)
  return notEmpty((item as Sentence).japaneseText)
}

function isEmpty(item: Grammar | Vocabulary | Sentence): boolean {
  return !hasContent(item)
}

/** Build update payload from a backup/last-sent so we can PATCH the server. */
function toUpdatePayload(
  type: 'grammar' | 'vocab' | 'sentence',
  source: Record<string, unknown>
): Record<string, unknown> | null {
  if (type === 'grammar') {
    const title = (source.title ?? '').toString().trim()
    const explanation = (source.explanation ?? '').toString().trim()
    if (!title && !explanation) return null
    return {
      title: title || undefined,
      explanation: explanation || undefined,
      exampleSentence: (source.exampleSentence ?? '').toString().trim() || undefined,
      exampleTranslation: (source.exampleTranslation ?? '').toString().trim() || undefined,
      lesson: (source.lesson ?? '').toString().trim() || undefined,
    }
  }
  if (type === 'vocab') {
    const word = (source.word ?? '').toString().trim()
    const meaning = (source.meaning ?? '').toString().trim()
    if (!word && !meaning) return null
    return {
      word: word || undefined,
      reading: (source.reading ?? '').toString().trim() || undefined,
      meaning: meaning || undefined,
      exampleSentence: (source.exampleSentence ?? '').toString().trim() || undefined,
      lesson: (source.lesson ?? '').toString().trim() || undefined,
      conjugation: source.conjugation ?? undefined,
    }
  }
  const japaneseText = (source.japaneseText ?? '').toString().trim()
  const translation = (source.translation ?? '').toString().trim()
  if (!japaneseText && !translation) return null
  return {
    japaneseText: japaneseText || undefined,
    translation: translation || undefined,
    linkedGrammar: (source.linkedGrammar ?? '').toString().trim() || undefined,
    lesson: (source.lesson ?? '').toString().trim() || undefined,
  }
}

export interface Recoverable {
  type: 'grammar' | 'vocab' | 'sentence'
  id: string
  updates: Record<string, unknown>
}

/**
 * Find items that have empty main content but we have a recoverable version (backup or last-sent).
 * Excludes ids we already recovered this session.
 */
export function findRecoverable(
  grammar: Grammar[],
  vocab: Vocabulary[],
  sentences: Sentence[]
): Recoverable[] {
  const recovered = getRecoveredSet()
  const out: Recoverable[] = []
  const addedIds = new Set<string>()
  const CREATE_RECENT_MS = 5 * 60 * 1000

  function markAdded(type: 'grammar' | 'vocab' | 'sentence', id: string) {
    addedIds.add(type + '_' + normId(id))
  }

  for (const item of grammar) {
    if (recovered.has('grammar_' + normId(item.id))) continue
    if (!isEmpty(item)) continue
    const backup = getBackupItem('grammar', item.id) as Grammar | null
    let payload: Record<string, unknown> | null = backup ? toUpdatePayload('grammar', backup) : null
    if (!payload) payload = getLastSentUpdate('grammar', item.id)
    if (payload && (payload.title || payload.explanation)) {
      out.push({ type: 'grammar', id: item.id, updates: payload })
      markAdded('grammar', item.id)
    }
  }
  const lastCreateGrammar = getLastSentCreate('grammar')
  if (lastCreateGrammar && Date.now() - lastCreateGrammar.at < CREATE_RECENT_MS) {
    const emptyGrammar = grammar.filter((x) => !recovered.has('grammar_' + normId(x.id)) && isEmpty(x))
    const byCreated = [...emptyGrammar].sort((a, b) => (b.created || '').localeCompare(a.created || ''))
    const payload = toUpdatePayload('grammar', lastCreateGrammar.payload)
    if (byCreated.length > 0 && payload && (payload.title || payload.explanation)) {
      out.push({ type: 'grammar', id: byCreated[0].id, updates: payload })
      markAdded('grammar', byCreated[0].id)
    }
  }
  const emptyGrammarBulk = grammar.filter((x) => !recovered.has('grammar_' + normId(x.id)) && isEmpty(x) && !addedIds.has('grammar_' + normId(x.id)))
  const bulkGrammar = getLastSentBulk('grammar')
  if (emptyGrammarBulk.length > 0 && bulkGrammar && Date.now() - bulkGrammar.at < CREATE_RECENT_MS && bulkGrammar.payloads.length >= emptyGrammarBulk.length) {
    const byCreated = [...emptyGrammarBulk].sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    for (let i = 0; i < byCreated.length; i++) {
      const payload = toUpdatePayload('grammar', bulkGrammar.payloads[i])
      if (payload && (payload.title || payload.explanation)) {
        out.push({ type: 'grammar', id: byCreated[i].id, updates: payload })
        markAdded('grammar', byCreated[i].id)
      }
    }
  }

  for (const item of vocab) {
    if (recovered.has('vocab_' + normId(item.id))) continue
    if (!isEmpty(item)) continue
    const backup = getBackupItem('vocab', item.id) as Vocabulary | null
    let payload: Record<string, unknown> | null = backup ? toUpdatePayload('vocab', backup) : null
    if (!payload) payload = getLastSentUpdate('vocab', item.id)
    if (payload && (payload.word || payload.meaning)) {
      out.push({ type: 'vocab', id: item.id, updates: payload })
      markAdded('vocab', item.id)
    }
  }
  const lastCreateVocab = getLastSentCreate('vocab')
  if (lastCreateVocab && Date.now() - lastCreateVocab.at < CREATE_RECENT_MS) {
    const emptyVocab = vocab.filter((x) => !recovered.has('vocab_' + normId(x.id)) && isEmpty(x))
    const byCreated = [...emptyVocab].sort((a, b) => (b.created || '').localeCompare(a.created || ''))
    const payload = toUpdatePayload('vocab', lastCreateVocab.payload)
    if (byCreated.length > 0 && payload && (payload.word || payload.meaning)) {
      out.push({ type: 'vocab', id: byCreated[0].id, updates: payload })
      markAdded('vocab', byCreated[0].id)
    }
  }
  const emptyVocabBulk = vocab.filter((x) => !recovered.has('vocab_' + normId(x.id)) && isEmpty(x) && !addedIds.has('vocab_' + normId(x.id)))
  const bulkVocab = getLastSentBulk('vocab')
  if (emptyVocabBulk.length > 0 && bulkVocab && Date.now() - bulkVocab.at < CREATE_RECENT_MS && bulkVocab.payloads.length >= emptyVocabBulk.length) {
    const byCreated = [...emptyVocabBulk].sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    for (let i = 0; i < byCreated.length; i++) {
      const payload = toUpdatePayload('vocab', bulkVocab.payloads[i])
      if (payload && (payload.word || payload.meaning)) {
        out.push({ type: 'vocab', id: byCreated[i].id, updates: payload })
        markAdded('vocab', byCreated[i].id)
      }
    }
  }

  for (const item of sentences) {
    if (recovered.has('sentence_' + normId(item.id))) continue
    if (!isEmpty(item)) continue
    const backup = getBackupItem('sentence', item.id) as Sentence | null
    let payload: Record<string, unknown> | null = backup ? toUpdatePayload('sentence', backup) : null
    if (!payload) payload = getLastSentUpdate('sentence', item.id)
    if (payload && (payload.japaneseText || payload.translation)) {
      out.push({ type: 'sentence', id: item.id, updates: payload })
      markAdded('sentence', item.id)
    }
  }
  const lastCreateSentence = getLastSentCreate('sentence')
  if (lastCreateSentence && Date.now() - lastCreateSentence.at < CREATE_RECENT_MS) {
    const emptySentences = sentences.filter((x) => !recovered.has('sentence_' + normId(x.id)) && isEmpty(x))
    const byCreated = [...emptySentences].sort((a, b) => (b.created || '').localeCompare(a.created || ''))
    const payload = toUpdatePayload('sentence', lastCreateSentence.payload)
    if (byCreated.length > 0 && payload && (payload.japaneseText || payload.translation)) {
      out.push({ type: 'sentence', id: byCreated[0].id, updates: payload })
      markAdded('sentence', byCreated[0].id)
    }
  }
  const emptySentenceBulk = sentences.filter((x) => !recovered.has('sentence_' + normId(x.id)) && isEmpty(x) && !addedIds.has('sentence_' + normId(x.id)))
  const bulkSentence = getLastSentBulk('sentence')
  if (emptySentenceBulk.length > 0 && bulkSentence && Date.now() - bulkSentence.at < CREATE_RECENT_MS && bulkSentence.payloads.length >= emptySentenceBulk.length) {
    const byCreated = [...emptySentenceBulk].sort((a, b) => (a.created || '').localeCompare(b.created || ''))
    for (let i = 0; i < byCreated.length; i++) {
      const payload = toUpdatePayload('sentence', bulkSentence.payloads[i])
      if (payload && (payload.japaneseText || payload.translation)) {
        out.push({ type: 'sentence', id: byCreated[i].id, updates: payload })
        markAdded('sentence', byCreated[i].id)
      }
    }
  }
  const seen = new Set<string>()
  const deduped = out.filter((r) => {
    const key = r.type + '_' + r.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (deduped.length > 0) {
    console.warn('[Recovery] Will restore', deduped.length, 'item(s) from backup/last-sent')
  }
  return deduped
}

export function markRecovered(type: 'grammar' | 'vocab' | 'sentence', id: string): void {
  addRecovered(type + '_' + normId(id))
  clearLastSentUpdate(type, id)
}
