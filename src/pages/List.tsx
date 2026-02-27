import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { useStorage } from '../store/StorageContext'
import type { Item, Grammar, Vocabulary, Sentence, VerbConjugation } from '../types'
import { isGrammar, isVocabulary, isSentence } from '../types'

const CONJUGATION_FIELDS: { key: keyof VerbConjugation; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'negative', label: 'Negative' },
  { key: 'past', label: 'Past' },
  { key: 'pastNegative', label: 'Past Negative' },
  { key: 'teForm', label: 'Te-form' },
  { key: 'taiForm', label: 'Tai-form' },
]
import type { ApiClient } from '../api/client'
import { getJapanDictUrl } from '../services/jisho'

type FilterType = 'all' | 'grammar' | 'vocab' | 'sentence'

export default function List() {
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const storage = useStorage()
  const { grammar, vocab, sentences, refresh } = useItems()
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [lessonFilter, setLessonFilter] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const lessons = useMemo(() => {
    const set = new Set<string>()
    grammar.forEach((g) => g.lesson && set.add(g.lesson))
    vocab.forEach((v) => v.lesson && set.add(v.lesson))
    sentences.forEach((s) => s.lesson && set.add(s.lesson))
    return Array.from(set).sort()
  }, [grammar, vocab, sentences])

  const items: Item[] = useMemo(() => {
    let list: Item[] = []
    if (filterType === 'all' || filterType === 'grammar') list = list.concat(grammar)
    if (filterType === 'all' || filterType === 'vocab') list = list.concat(vocab)
    if (filterType === 'all' || filterType === 'sentence') list = list.concat(sentences)
    if (lessonFilter) list = list.filter((i) => i.lesson === lessonFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((i) => {
        if (isGrammar(i)) return i.title.toLowerCase().includes(q) || i.explanation.toLowerCase().includes(q)
        if (isVocabulary(i)) return i.word.includes(q) || (i.meaning && i.meaning.toLowerCase().includes(q)) || i.reading.includes(q)
        if (isSentence(i)) return i.japaneseText.includes(q) || i.translation.toLowerCase().includes(q)
        return false
      })
    }
    return list
  }, [grammar, vocab, sentences, filterType, lessonFilter, search])

  const handleRefresh = () => {
    refresh()
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Browse all</h1>

      <div className="flex flex-wrap gap-4 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-stone-600">Type:</span>
          {(['all', 'grammar', 'vocab', 'sentence'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${
                filterType === t ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-stone-600">Lesson:</label>
          <select
            value={lessonFilter}
            onChange={(e) => setLessonFilter(e.target.value)}
            className="rounded border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {lessons.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            id={item.id === highlightId ? 'highlight' : undefined}
            className={`rounded-lg border bg-white p-4 ${
              item.id === highlightId ? 'border-rose-400 ring-2 ring-rose-200' : 'border-stone-200'
            }`}
          >
            {editingId === item.id ? (
              isGrammar(item) ? (
                <EditGrammarForm
                  storage={storage}
                  item={item}
                  onDone={() => { handleRefresh(); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                />
              ) : isVocabulary(item) ? (
                <EditVocabForm
                  storage={storage}
                  item={item}
                  onDone={() => { handleRefresh(); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <EditSentenceForm
                  storage={storage}
                  item={item}
                  onDone={() => { handleRefresh(); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                />
              )
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600 capitalize">
                    {item.type}
                  </span>
                  {item.lesson && (
                    <span className="text-xs text-stone-500">Lesson: {item.lesson}</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(item.id)}
                      className="text-sm text-rose-600 hover:underline"
                    >
                      Edit
                    </button>
                    {isVocabulary(item) && (
                      <a
                        href={getJapanDictUrl(item.word)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-rose-600 hover:underline"
                      >
                        Open in JapanDict
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this item?')) {
                          const p = isGrammar(item)
                            ? storage.deleteGrammar(item.id)
                            : isVocabulary(item)
                              ? storage.deleteVocab(item.id)
                              : storage.deleteSentence(item.id)
                          p.then(handleRefresh).catch((err) => console.error(err))
                        }
                      }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {isGrammar(item) && (
                  <div className="mt-2">
                    <p className="font-medium text-stone-800">{item.title}</p>
                    <p className="text-sm text-stone-600">{item.explanation}</p>
                    {item.exampleSentence && (
                      <p className="mt-1 text-sm italic text-stone-500">{item.exampleSentence} — {item.exampleTranslation}</p>
                    )}
                  </div>
                )}
                {isVocabulary(item) && (
                  <div className="mt-2">
                    <p className="font-medium text-stone-800">{item.word} {item.reading && `（${item.reading}）`}</p>
                    <p className="text-sm text-stone-600">{item.meaning || '—'}</p>
                    {item.exampleSentence && <p className="mt-1 text-sm text-stone-500">{item.exampleSentence}</p>}
                    {item.conjugation && Object.keys(item.conjugation).some((k) => item.conjugation?.[k as keyof VerbConjugation]?.trim()) && (
                      <div className="mt-2 rounded border border-stone-100 bg-stone-50/50 p-2">
                        <span className="text-xs font-medium text-stone-500">Verb conjugation:</span>
                        <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-stone-600 sm:grid-cols-3">
                          {CONJUGATION_FIELDS.map(({ key, label }) => {
                            const v = item.conjugation?.[key]?.trim()
                            if (!v) return null
                            return (
                              <li key={key}>
                                {label}: {v}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {isSentence(item) && (
                  <div className="mt-2">
                    <p className="text-stone-800">{item.japaneseText}</p>
                    <p className="text-sm text-stone-600">{item.translation}</p>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="rounded-lg border border-stone-200 bg-white p-6 text-center text-stone-500">
          No items match. Try changing filters or add items.
        </p>
      )}
    </div>
  )
}

function EditGrammarForm({
  storage,
  item,
  onDone,
  onCancel,
}: {
  storage: ApiClient
  item: Grammar
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [explanation, setExplanation] = useState(item.explanation)
  const [exampleSentence, setExampleSentence] = useState(item.exampleSentence)
  const [exampleTranslation, setExampleTranslation] = useState(item.exampleTranslation)
  const [lesson, setLesson] = useState(item.lesson)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        storage
          .updateGrammar(item.id, { title, explanation, exampleSentence, exampleTranslation, lesson })
          .then(onDone)
          .catch((err) => console.error(err))
      }}
      className="space-y-3"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Title" />
      <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full rounded border px-2 py-1" rows={2} />
      <input value={exampleSentence} onChange={(e) => setExampleSentence(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Example sentence" />
      <input value={exampleTranslation} onChange={(e) => setExampleTranslation(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Translation" />
      <input value={lesson} onChange={(e) => setLesson(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Lesson" />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-rose-600 px-3 py-1 text-white text-sm">Save</button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function EditVocabForm({
  storage,
  item,
  onDone,
  onCancel,
}: {
  storage: ApiClient
  item: Vocabulary
  onDone: () => void
  onCancel: () => void
}) {
  const [word, setWord] = useState(item.word)
  const [reading, setReading] = useState(item.reading)
  const [meaning, setMeaning] = useState(item.meaning)
  const [exampleSentence, setExampleSentence] = useState(item.exampleSentence)
  const [lesson, setLesson] = useState(item.lesson)
  const [conjugation, setConjugation] = useState<VerbConjugation>({
    present: item.conjugation?.present ?? '',
    negative: item.conjugation?.negative ?? '',
    past: item.conjugation?.past ?? '',
    pastNegative: item.conjugation?.pastNegative ?? '',
    teForm: item.conjugation?.teForm ?? '',
    taiForm: item.conjugation?.taiForm ?? '',
  })
  const setConjugationField = (key: keyof VerbConjugation, value: string) => {
    setConjugation((prev) => ({ ...prev, [key]: value }))
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const conj: VerbConjugation = {}
        CONJUGATION_FIELDS.forEach(({ key }) => {
          const v = conjugation[key]?.trim()
          if (v) conj[key] = v
        })
        storage
          .updateVocab(item.id, {
            word,
            reading,
            meaning,
            exampleSentence,
            lesson,
            conjugation: Object.keys(conj).length ? conj : undefined,
          })
          .then(onDone)
          .catch((err) => console.error(err))
      }}
      className="space-y-3"
    >
      <input value={word} onChange={(e) => setWord(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Word" />
      <input value={reading} onChange={(e) => setReading(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Reading" />
      <input value={meaning} onChange={(e) => setMeaning(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Meaning" />
      <input value={exampleSentence} onChange={(e) => setExampleSentence(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Example" />
      <input value={lesson} onChange={(e) => setLesson(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Lesson" />
      <div className="rounded border border-stone-200 bg-stone-50/50 p-2">
        <span className="text-xs font-medium text-stone-600">Verb conjugation</span>
        <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {CONJUGATION_FIELDS.map(({ key, label }) => (
            <input
              key={key}
              value={conjugation[key] ?? ''}
              onChange={(e) => setConjugationField(key, e.target.value)}
              className="rounded border border-stone-200 px-2 py-1 text-sm"
              placeholder={label}
            />
          ))}
        </div>
      </div>
      <p className="text-sm">
        <a href={getJapanDictUrl(word)} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:underline">Open in JapanDict</a>
      </p>
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-rose-600 px-3 py-1 text-white text-sm">Save</button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1 text-sm">Cancel</button>
      </div>
    </form>
  )
}

function EditSentenceForm({
  storage,
  item,
  onDone,
  onCancel,
}: {
  storage: ApiClient
  item: Sentence
  onDone: () => void
  onCancel: () => void
}) {
  const [japaneseText, setJapaneseText] = useState(item.japaneseText)
  const [translation, setTranslation] = useState(item.translation)
  const [linkedGrammar, setLinkedGrammar] = useState(item.linkedGrammar ?? '')
  const [lesson, setLesson] = useState(item.lesson)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        storage
          .updateSentence(item.id, { japaneseText, translation, linkedGrammar: linkedGrammar || undefined, lesson })
          .then(onDone)
          .catch((err) => console.error(err))
      }}
      className="space-y-3"
    >
      <input value={japaneseText} onChange={(e) => setJapaneseText(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Japanese" />
      <input value={translation} onChange={(e) => setTranslation(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Translation" />
      <input value={linkedGrammar} onChange={(e) => setLinkedGrammar(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Linked grammar" />
      <input value={lesson} onChange={(e) => setLesson(e.target.value)} className="w-full rounded border px-2 py-1" placeholder="Lesson" />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-rose-600 px-3 py-1 text-white text-sm">Save</button>
        <button type="button" onClick={onCancel} className="rounded border px-3 py-1 text-sm">Cancel</button>
      </div>
    </form>
  )
}
