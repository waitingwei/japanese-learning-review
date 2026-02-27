import { useState } from 'react'
import { useStorage, useAuthToken } from '../store/StorageContext'
import type { ApiClient } from '../api/client'
import { lookupJisho, getJapanDictUrl } from '../services/jisho'
import type { VerbConjugation } from '../types'

const CONJUGATION_FIELDS: { key: keyof VerbConjugation; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'negative', label: 'Negative' },
  { key: 'past', label: 'Past' },
  { key: 'pastNegative', label: 'Past Negative' },
  { key: 'teForm', label: 'Te-form' },
  { key: 'taiForm', label: 'Tai-form' },
]

export default function Add() {
  const storage = useStorage()
  const [kind, setKind] = useState<'grammar' | 'vocab' | 'sentence'>('vocab')
  const [saved, setSaved] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Add item</h1>
      <p className="text-stone-600">Add a single grammar point, vocabulary item, or sentence.</p>

      <div className="flex gap-2">
        {(['grammar', 'vocab', 'sentence'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              kind === k ? 'bg-rose-600 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {kind === 'grammar' && (
        <AddGrammarForm storage={storage} onSaved={() => setSaved('Grammar saved.')} />
      )}
      {kind === 'vocab' && (
        <AddVocabForm storage={storage} onSaved={() => setSaved('Vocabulary saved.')} />
      )}
      {kind === 'sentence' && (
        <AddSentenceForm storage={storage} onSaved={() => setSaved('Sentence saved.')} />
      )}

      {saved && (
        <p className="rounded bg-green-100 p-3 text-green-800">{saved}</p>
      )}
    </div>
  )
}

function AddGrammarForm({ storage, onSaved }: { storage: ApiClient; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [explanation, setExplanation] = useState('')
  const [exampleSentence, setExampleSentence] = useState('')
  const [exampleTranslation, setExampleTranslation] = useState('')
  const [lesson, setLesson] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    storage
      .createGrammar({
        title: title.trim() || 'Untitled',
        explanation: explanation.trim(),
        exampleSentence: exampleSentence.trim(),
        exampleTranslation: exampleTranslation.trim(),
        lesson: lesson.trim(),
      })
      .then(() => {
        setTitle('')
        setExplanation('')
        setExampleSentence('')
        setExampleTranslation('')
        setLesson('')
        onSaved()
      })
      .catch((err) => console.error(err))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          placeholder="e.g. て-form"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Explanation</span>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          rows={3}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Example sentence</span>
        <input
          type="text"
          value={exampleSentence}
          onChange={(e) => setExampleSentence(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Example translation</span>
        <input
          type="text"
          value={exampleTranslation}
          onChange={(e) => setExampleTranslation(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Lesson (optional)</span>
        <input
          type="text"
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          placeholder="e.g. Lesson 5"
        />
      </label>
      <button type="submit" className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700">
        Save grammar
      </button>
    </form>
  )
}

function emptyConjugation(): VerbConjugation {
  return {
    present: '',
    negative: '',
    past: '',
    pastNegative: '',
    teForm: '',
    taiForm: '',
  }
}

function AddVocabForm({ storage, onSaved }: { storage: ApiClient; onSaved: () => void }) {
  const getToken = useAuthToken()
  const [word, setWord] = useState('')
  const [reading, setReading] = useState('')
  const [meaning, setMeaning] = useState('')
  const [exampleSentence, setExampleSentence] = useState('')
  const [lesson, setLesson] = useState('')
  const [conjugation, setConjugation] = useState<VerbConjugation>(emptyConjugation)
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const setConjugationField = (key: keyof VerbConjugation, value: string) => {
    setConjugation((prev) => ({ ...prev, [key]: value }))
  }

  const handleLookup = async () => {
    if (!word.trim()) return
    setLoading(true)
    setLookupError(null)
    try {
      const result = await lookupJisho(word.trim(), getToken ?? undefined)
      if (!result) {
        setLookupError('Lookup failed. Make sure the dev server is running and try again.')
        return
      }
      if (result.reading) setReading(result.reading)
      if (result.meaning) setMeaning(result.meaning)
      if (result.conjugation) {
        setConjugation((prev) => ({
          ...emptyConjugation(),
          ...prev,
          ...result.conjugation,
        }))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const conj: VerbConjugation = {}
    CONJUGATION_FIELDS.forEach(({ key }) => {
      const v = conjugation[key]?.trim()
      if (v) conj[key] = v
    })
    storage
      .createVocab({
        word: word.trim() || '?',
        reading: reading.trim(),
        meaning: meaning.trim(),
        exampleSentence: exampleSentence.trim(),
        lesson: lesson.trim(),
        conjugation: Object.keys(conj).length ? conj : undefined,
      })
      .then(() => {
        setWord('')
        setReading('')
        setMeaning('')
        setExampleSentence('')
        setLesson('')
        setConjugation(emptyConjugation())
        onSaved()
      })
      .catch((err) => console.error(err))
  }

  const japandictUrl = word.trim() ? getJapanDictUrl(word) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Word</span>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="flex-1 rounded border border-stone-300 px-3 py-2"
            placeholder="e.g. 食べる"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={loading || !word.trim()}
            className="rounded-md border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50"
          >
            {loading ? 'Looking up…' : 'Look up'}
          </button>
        </div>
      </label>
      {japandictUrl && (
        <p className="text-sm">
          <a href={japandictUrl} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:underline">
            Open in JapanDict
          </a>
          {' '}for full entry and verb conjugations.
        </p>
      )}
      {lookupError && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">{lookupError}</p>
      )}
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Reading</span>
        <input
          type="text"
          value={reading}
          onChange={(e) => setReading(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          placeholder="e.g. たべる"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Meaning</span>
        <input
          type="text"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Example sentence (optional)</span>
        <input
          type="text"
          value={exampleSentence}
          onChange={(e) => setExampleSentence(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Lesson (optional)</span>
        <input
          type="text"
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          placeholder="e.g. Lesson 5"
        />
      </label>
      <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4">
        <span className="text-sm font-medium text-stone-700">Verb Conjugation</span>
        <p className="text-xs text-stone-500">Optional. Look up may auto-fill if the API returns forms; you can edit any field.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONJUGATION_FIELDS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="text-sm font-medium text-stone-600">{label}</span>
              <input
                type="text"
                value={conjugation[key] ?? ''}
                onChange={(e) => setConjugationField(key, e.target.value)}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                placeholder={label}
              />
            </label>
          ))}
        </div>
      </div>
      <button type="submit" className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700">
        Save vocabulary
      </button>
    </form>
  )
}

function AddSentenceForm({ storage, onSaved }: { storage: ApiClient; onSaved: () => void }) {
  const [japaneseText, setJapaneseText] = useState('')
  const [translation, setTranslation] = useState('')
  const [linkedGrammar, setLinkedGrammar] = useState('')
  const [lesson, setLesson] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    storage
      .createSentence({
        japaneseText: japaneseText.trim() || '?',
        translation: translation.trim(),
        linkedGrammar: linkedGrammar.trim() || undefined,
        lesson: lesson.trim(),
      })
      .then(() => {
        setJapaneseText('')
        setTranslation('')
        setLinkedGrammar('')
        setLesson('')
        onSaved()
      })
      .catch((err) => console.error(err))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Japanese text</span>
        <input
          type="text"
          value={japaneseText}
          onChange={(e) => setJapaneseText(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Translation</span>
        <input
          type="text"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Linked grammar (optional)</span>
        <input
          type="text"
          value={linkedGrammar}
          onChange={(e) => setLinkedGrammar(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Lesson (optional)</span>
        <input
          type="text"
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          placeholder="e.g. Lesson 5"
        />
      </label>
      <button type="submit" className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700">
        Save sentence
      </button>
    </form>
  )
}
