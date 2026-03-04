import type { Grammar, Vocabulary, Sentence, Item } from '../types'
import { useStorage } from '../store/StorageContext'
import { useRecoveryMessage } from '../store/RecoveryContext'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  saveBackup,
  findRecoverable,
  markRecovered,
} from '../store/recovery'

const useApi = (): boolean => import.meta.env.VITE_USE_API === 'true'

export function useItems(): {
  grammar: Grammar[]
  vocab: Vocabulary[]
  sentences: Sentence[]
  refresh: () => void
  loading: boolean
} {
  const storage = useStorage()
  const { setRecoverySuccess, setRecoveryFailed } = useRecoveryMessage()
  const [grammar, setGrammar] = useState<Grammar[]>([])
  const [vocab, setVocab] = useState<Vocabulary[]>([])
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)
  const inFlightRef = useRef(false)

  const load = useCallback(() => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    Promise.all([
      storage.getGrammar(),
      storage.getVocab(),
      storage.getSentences(),
    ]).then(([g, v, s]) => {
      inFlightRef.current = false

      if (useApi()) {
        const recoverable = findRecoverable(g, v, s)
        if (recoverable.length > 0) {
          if (import.meta.env.DEV) {
            console.warn('[Recovery] Restoring', recoverable.length, 'item(s):', recoverable.map((r) => ({ type: r.type, id: r.id })))
          }
          setRecoverySuccess(recoverable.length)
          Promise.all(
            recoverable.map((r) => {
              const p =
                r.type === 'grammar'
                  ? storage.updateGrammar(r.id, r.updates as Partial<Grammar>)
                  : r.type === 'vocab'
                    ? storage.updateVocab(r.id, r.updates as Partial<Vocabulary>)
                    : storage.updateSentence(r.id, r.updates as Partial<Sentence>)
              return p.then(() => markRecovered(r.type, r.id))
            })
          )
            .then(() => load())
            .catch((err) => {
              console.error('[Recovery] PATCH failed:', err)
              setRecoveryFailed()
              setGrammar(g)
              setVocab(v)
              setSentences(s)
              setLoading(false)
            })
          return
        }
        saveBackup(g, v, s)
      }

      setGrammar(g)
      setVocab(v)
      setSentences(s)
      setLoading(false)
    }).catch(() => {
      inFlightRef.current = false
      setLoading(false)
    })
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
