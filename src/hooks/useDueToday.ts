import type { Item } from '../types'
import { isDueToday } from '../store/srs'
import { useStorage } from '../store/StorageContext'
import { useState, useCallback, useEffect } from 'react'

export function useDueToday(): { items: Item[]; refresh: () => void; loading: boolean } {
  const storage = useStorage()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    Promise.all([
      storage.getGrammar(),
      storage.getVocab(),
      storage.getSentences(),
    ]).then(([grammar, vocab, sentences]) => {
      const grammarDue = grammar.filter((g) => g.srs && isDueToday(g.srs.nextReviewAt))
      const vocabDue = vocab.filter((v) => v.srs && isDueToday(v.srs.nextReviewAt))
      const sentencesDue = sentences.filter((s) => s.srs && isDueToday(s.srs.nextReviewAt))
      setItems([...grammarDue, ...vocabDue, ...sentencesDue])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [storage])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { items, refresh, loading }
}
