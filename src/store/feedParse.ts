import type { Grammar, Vocabulary, Sentence } from '../types'
import { lookupJisho } from '../services/jisho'

type FeedType = 'grammar' | 'vocab' | 'sentence'

export interface ParsedRow {
  type: FeedType
  lesson: string
  grammar?: Omit<Grammar, 'id' | 'type' | 'created' | 'srs'>
  vocab?: Omit<Vocabulary, 'id' | 'type' | 'created' | 'srs'>
  sentence?: Omit<Sentence, 'id' | 'type' | 'created' | 'srs'>
}

export function parsePaste(
  text: string,
  type: FeedType,
  lesson: string,
  delimiter: string
): ParsedRow[] {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean)
  const result: ParsedRow[] = []
  const delim = delimiter === 'tab' ? '\t' : delimiter === 'comma' ? ',' : '|'
  for (const row of rows) {
    const parts = row.split(delim).map((p) => p.trim())
    if (type === 'vocab') {
      const [word = '', reading = '', meaning = ''] = parts
      result.push({ type, lesson, vocab: { word: word || parts[0] || '', reading, meaning, exampleSentence: '', lesson } })
    } else if (type === 'grammar') {
      const [title = '', explanation = '', exampleSentence = '', exampleTranslation = ''] = parts
      result.push({
        type,
        lesson,
        grammar: { title: title || parts[0] || '', explanation, exampleSentence, exampleTranslation, lesson },
      })
    } else {
      const [japaneseText = '', translation = ''] = parts
      result.push({ type, lesson, sentence: { japaneseText: japaneseText || parts[0] || '', translation, lesson } })
    }
  }
  return result
}

export function parseCSV(text: string, type: FeedType, lesson: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    header.forEach((h, j) => { row[h] = values[j] ?? '' })
    if (type === 'vocab') {
      rows.push({
        type,
        lesson,
        vocab: {
          word: row['word'] ?? row['japanese'] ?? '',
          reading: row['reading'] ?? '',
          meaning: row['meaning'] ?? row['english'] ?? '',
          exampleSentence: row['example'] ?? '',
          lesson,
        },
      })
    } else if (type === 'grammar') {
      rows.push({
        type,
        lesson,
        grammar: {
          title: row['title'] ?? '',
          explanation: row['explanation'] ?? '',
          exampleSentence: row['example'] ?? '',
          exampleTranslation: row['translation'] ?? '',
          lesson,
        },
      })
    } else {
      rows.push({
        type,
        lesson,
        sentence: {
          japaneseText: row['japanese'] ?? row['text'] ?? '',
          translation: row['translation'] ?? row['english'] ?? '',
          lesson,
        },
      })
    }
  }
  return rows
}

export function parseJSON(text: string, type: FeedType, lesson: string): ParsedRow[] {
  try {
    const data = JSON.parse(text)
    const arr = Array.isArray(data) ? data : [data]
    const rows: ParsedRow[] = []
    for (const o of arr) {
      if (type === 'vocab') {
        rows.push({
          type,
          lesson: (o as { lesson?: string }).lesson ?? lesson,
          vocab: {
            word: (o as { word?: string }).word ?? '',
            reading: (o as { reading?: string }).reading ?? '',
            meaning: (o as { meaning?: string }).meaning ?? '',
            exampleSentence: (o as { exampleSentence?: string }).exampleSentence ?? '',
            lesson: (o as { lesson?: string }).lesson ?? lesson,
          },
        })
      } else if (type === 'grammar') {
        rows.push({
          type,
          lesson: (o as { lesson?: string }).lesson ?? lesson,
          grammar: {
            title: (o as { title?: string }).title ?? '',
            explanation: (o as { explanation?: string }).explanation ?? '',
            exampleSentence: (o as { exampleSentence?: string }).exampleSentence ?? '',
            exampleTranslation: (o as { exampleTranslation?: string }).exampleTranslation ?? '',
            lesson: (o as { lesson?: string }).lesson ?? lesson,
          },
        })
      } else {
        rows.push({
          type,
          lesson: (o as { lesson?: string }).lesson ?? lesson,
          sentence: {
            japaneseText: (o as { japaneseText?: string }).japaneseText ?? (o as { japanese?: string }).japanese ?? '',
            translation: (o as { translation?: string }).translation ?? '',
            lesson: (o as { lesson?: string }).lesson ?? lesson,
          },
        })
      }
    }
    return rows
  } catch {
    return []
  }
}

export async function enrichVocabWithJisho(
  rows: ParsedRow[],
  getToken?: () => Promise<string | null>
): Promise<ParsedRow[]> {
  const out: ParsedRow[] = []
  for (const row of rows) {
    if (row.type !== 'vocab' || !row.vocab) {
      out.push(row)
      continue
    }
    const { word, meaning, reading } = row.vocab
    if (word && (!meaning || !reading)) {
      const res = await lookupJisho(word, getToken)
      if (res) {
        out.push({
          ...row,
          vocab: {
            ...row.vocab,
            reading: reading || res.reading,
            meaning: meaning || res.meaning,
          },
        })
        continue
      }
    }
    out.push(row)
  }
  return out
}
