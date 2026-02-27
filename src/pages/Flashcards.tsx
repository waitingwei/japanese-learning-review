import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { useStorage } from '../store/StorageContext'
import { isDueToday } from '../store/srs'
import { nextSRS, type Rating } from '../store/srs'
import type { Item, VerbConjugation } from '../types'
import { isGrammar, isVocabulary, isSentence } from '../types'

const CONJUGATION_FIELDS: { key: keyof VerbConjugation; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'negative', label: 'Negative' },
  { key: 'past', label: 'Past' },
  { key: 'pastNegative', label: 'Past Negative' },
  { key: 'teForm', label: 'Te-form' },
  { key: 'taiForm', label: 'Tai-form' },
]
import { getJapanDictUrl } from '../services/jisho'

export default function Flashcards() {
  const storage = useStorage()
  const { grammar, vocab, sentences } = useItems()
  const [deck, setDeck] = useState<'due' | 'all'>('due')
  const [lessonFilter, setLessonFilter] = useState('')
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)

  const lessons = useMemo(() => {
    const set = new Set<string>()
    grammar.forEach((i) => i.lesson && set.add(i.lesson))
    vocab.forEach((i) => i.lesson && set.add(i.lesson))
    sentences.forEach((i) => i.lesson && set.add(i.lesson))
    return Array.from(set).sort()
  }, [grammar, vocab, sentences])

  const cards: Item[] = useMemo(() => {
    let list: Item[] = []
    if (deck === 'due') {
      list = [
        ...grammar.filter((g) => g.srs && isDueToday(g.srs.nextReviewAt)),
        ...vocab.filter((v) => v.srs && isDueToday(v.srs.nextReviewAt)),
        ...sentences.filter((s) => s.srs && isDueToday(s.srs.nextReviewAt)),
      ]
    } else {
      list = [...grammar, ...vocab, ...sentences]
    }
    if (lessonFilter) list = list.filter((i) => i.lesson === lessonFilter)
    return list
  }, [grammar, vocab, sentences, deck, lessonFilter, started, index])

  const current = cards[index]
  const total = cards.length

  useEffect(() => {
    setShowBack(false)
  }, [index])

  const rate = (rating: Rating) => {
    if (!current?.srs) return
    const next = nextSRS(current.srs, rating)
    const p = isGrammar(current)
      ? storage.updateGrammar(current.id, { srs: next })
      : isVocabulary(current)
        ? storage.updateVocab(current.id, { srs: next })
        : storage.updateSentence(current.id, { srs: next })
    p.catch((err) => console.error(err))
    setShowBack(false)
    if (index + 1 >= total) {
      setStarted(false)
      setIndex(0)
    } else setIndex(index + 1)
  }

  if (!started) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-800">Flashcards</h1>
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <p className="mb-4 text-stone-600">Choose a deck and optional lesson filter.</p>
          <div className="mb-4 flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="deck"
                checked={deck === 'due'}
                onChange={() => setDeck('due')}
              />
              Due today
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="deck"
                checked={deck === 'all'}
                onChange={() => setDeck('all')}
              />
              All
            </label>
          </div>
          <div className="mb-4">
            <label className="text-sm font-medium text-stone-700">Lesson (optional)</label>
            <select
              value={lessonFilter}
              onChange={(e) => setLessonFilter(e.target.value)}
              className="ml-2 rounded border border-stone-300 px-2 py-1"
            >
              <option value="">All</option>
              {lessons.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <p className="mb-4 text-stone-600">
            <strong>{cards.length}</strong> card{cards.length !== 1 ? 's' : ''} in deck.
          </p>
          {cards.length === 0 ? (
            <p className="text-stone-500">No cards. Add items or come back when you have items due.</p>
          ) : (
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
            >
              Start session
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-stone-800">Flashcards</h1>
        <p className="rounded-lg border border-stone-200 bg-white p-6 text-center text-stone-600">
          No more cards in this session. <Link to="/" className="text-rose-600 hover:underline">Back to dashboard</Link>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Flashcards</h1>
      <p className="text-stone-600">
        Card {index + 1} of {total}
      </p>
      <div
        className="min-h-[200px] cursor-pointer rounded-lg border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-stone-300"
        onClick={() => setShowBack((b) => !b)}
      >
        {!showBack ? (
          <>
            <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600 capitalize">
              {current.type}
            </span>
            <div className="mt-4 text-xl font-medium text-stone-800">
              {isGrammar(current) && current.title}
              {isVocabulary(current) && current.word}
              {isSentence(current) && current.japaneseText}
            </div>
            <p className="mt-4 text-sm text-stone-500">Tap to flip</p>
          </>
        ) : (
          <>
            <div className="text-stone-800">
              {isGrammar(current) && (
                <>
                  <p className="font-medium">{current.title}</p>
                  <p className="mt-2 text-sm">{current.explanation}</p>
                  {current.exampleSentence && (
                    <p className="mt-2 text-sm italic">{current.exampleSentence} — {current.exampleTranslation}</p>
                  )}
                </>
              )}
              {isVocabulary(current) && (
                <>
                  <p className="font-medium">{current.word}</p>
                  {current.reading && <p className="mt-1 text-stone-600">Reading: {current.reading}</p>}
                  <p className="mt-2">{current.meaning || '—'}</p>
                  {current.conjugation && Object.keys(current.conjugation).some((k) => current.conjugation?.[k as keyof VerbConjugation]?.trim()) && (
                    <div className="mt-3 rounded border border-stone-200 bg-stone-50/50 p-2">
                      <span className="text-xs font-medium text-stone-500">Verb conjugation</span>
                      <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
                        {CONJUGATION_FIELDS.map(({ key, label }) => {
                          const v = current.conjugation?.[key]?.trim()
                          if (!v) return null
                          return (
                            <li key={key}>
                              <span className="text-stone-500">{label}:</span> {v}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                  <a
                    href={getJapanDictUrl(current.word)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-rose-600 hover:underline"
                  >
                    Open in JapanDict
                  </a>
                </>
              )}
              {isSentence(current) && (
                <>
                  <p>{current.japaneseText}</p>
                  <p className="mt-2 text-stone-600">{current.translation}</p>
                </>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => rate('again')}
                className="rounded bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Again
              </button>
              <button
                type="button"
                onClick={() => rate('good')}
                className="rounded bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
              >
                Good
              </button>
              <button
                type="button"
                onClick={() => rate('easy')}
                className="rounded bg-green-100 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-200"
              >
                Easy
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
