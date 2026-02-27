import type { Grammar, Vocabulary, Sentence, Item } from '../types'
import { useStorage } from '../store/StorageContext'
import { useState, useCallback, useEffect } from 'react'

export function useItems(): {
  grammar: Grammar[]
  vocab: Vocabulary[]
  sentences: Sentence[]
  refresh: () => void
  loading: boolean
} {
  const storage = useStorage()
  const [grammar, setGrammar] = useState<Grammar[]>([])
  const [vocab, setVocab] = useState<Vocabulary[]>([])
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      storage.getGrammar(),
      storage.getVocab(),
      storage.getSentences(),
    ]).then(([g, v, s]) => {
      setGrammar(g)
      setVocab(v)
      setSentences(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [storage])

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(() => {
    load()
  }, [load])

  return { grammar, vocab, sentences, refresh, loading }
}

export function getAllItems(grammar: Grammar[], vocab: Vocabulary[], sentences: Sentence[]): Item[] {
  return [...grammar, ...vocab, ...sentences]
}
