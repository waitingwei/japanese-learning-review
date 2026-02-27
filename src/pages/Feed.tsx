import { useState, useCallback } from 'react'
import { useStorage } from '../store/StorageContext'
import {
  parsePaste,
  parseCSV,
  parseJSON,
  enrichVocabWithJisho,
  type ParsedRow,
} from '../store/feedParse'

type FeedType = 'grammar' | 'vocab' | 'sentence'

async function extractPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist')
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    }
    const pdf = await pdfjs.getDocument({ data: buffer }).promise
    const numPages = pdf.numPages
    const parts: string[] = []
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: unknown) => (item && typeof item === 'object' && 'str' in item ? (item as { str?: string }).str : ''))
      .join(' ')
      parts.push(text)
    }
    return parts.join('\n')
  } catch (err) {
    console.error('PDF extract failed', err)
    throw new Error('Could not read PDF. Try copying text manually.')
  }
}

export default function Feed() {
  const storage = useStorage()
  const [type, setType] = useState<FeedType>('vocab')
  const [lesson, setLesson] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [delimiter, setDelimiter] = useState<'tab' | 'comma' | 'pipe'>('tab')
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [importDone, setImportDone] = useState<string | null>(null)
  const [useCSVHeader, setUseCSVHeader] = useState(false)

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const name = file.name.toLowerCase()
      let text: string
      if (name.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer()
        text = await extractPDF(buffer)
      } else {
        text = await file.text()
      }
      setPasteText(text)
      setParsed([])
      setUseCSVHeader(name.endsWith('.csv'))
      e.target.value = ''
    },
    []
  )

  const handleParse = useCallback(() => {
    if (!pasteText.trim()) return
    let rows: ParsedRow[]
    const trimmed = pasteText.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      rows = parseJSON(pasteText, type, lesson)
    } else if (useCSVHeader && pasteText.includes(',')) {
      rows = parseCSV(pasteText, type, lesson)
    } else {
      const delim = delimiter === 'tab' ? '\t' : delimiter === 'comma' ? ',' : '|'
      rows = parsePaste(pasteText, type, lesson, delim)
    }
    setParsed(rows)
    setImportDone(null)
  }, [pasteText, type, lesson, delimiter, useCSVHeader])

  const handleLookupAll = useCallback(async () => {
    if (type !== 'vocab' || parsed.length === 0) return
    setLookupLoading(true)
    try {
      const enriched = await enrichVocabWithJisho(parsed)
      setParsed(enriched)
    } finally {
      setLookupLoading(false)
    }
  }, [type, parsed])

  const handleImport = useCallback(() => {
    const grammarItems = parsed.filter((r) => r.grammar).map((r) => r.grammar!)
    const vocabItems = parsed.filter((r) => r.vocab).map((r) => r.vocab!)
    const sentenceItems = parsed.filter((r) => r.sentence).map((r) => r.sentence!)
    const promises: Promise<unknown>[] = []
    if (grammarItems.length) promises.push(storage.addGrammarBulk(grammarItems))
    if (vocabItems.length) promises.push(storage.addVocabBulk(vocabItems))
    if (sentenceItems.length) promises.push(storage.addSentencesBulk(sentenceItems))
    Promise.all(promises)
      .then(() => {
        setImportDone(`Imported ${grammarItems.length + vocabItems.length + sentenceItems.length} items.`)
        setParsed([])
        setPasteText('')
      })
      .catch((err) => console.error(err))
  }, [parsed, storage])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Feed / Import</h1>
      <p className="text-stone-600">
        Paste text or upload a file (CSV, JSON, .txt, or PDF). Choose type and optional lesson, then preview and import.
      </p>

      <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm font-medium text-stone-700">Type</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value as FeedType); setParsed([]) }}
              className="ml-2 rounded border border-stone-300 px-2 py-1"
            >
              <option value="grammar">Grammar</option>
              <option value="vocab">Vocab</option>
              <option value="sentence">Sentence</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Lesson (optional)</label>
            <input
              type="text"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              placeholder="e.g. Lesson 5"
              className="ml-2 rounded border border-stone-300 px-2 py-1"
            />
          </div>
          {!useCSVHeader && (
            <div>
              <label className="text-sm font-medium text-stone-700">Delimiter</label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as 'tab' | 'comma' | 'pipe')}
                className="ml-2 rounded border border-stone-300 px-2 py-1"
              >
                <option value="tab">Tab</option>
                <option value="comma">Comma</option>
                <option value="pipe">Pipe (|)</option>
              </select>
            </div>
          )}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={useCSVHeader}
                onChange={(e) => setUseCSVHeader(e.target.checked)}
              />
              First line is CSV headers
            </label>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700">Paste or upload</label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              type === 'vocab'
                ? 'One per line: word\treading\tmeaning or use CSV/JSON'
                : type === 'grammar'
                ? 'One per line: title\texplanation\texample\ttranslation'
                : 'One per line: japanese\ttranslation'
            }
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm"
            rows={8}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleParse}
              disabled={!pasteText.trim()}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Parse & preview
            </button>
            <label className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm cursor-pointer hover:bg-stone-50">
              Upload file (CSV, JSON, .txt, PDF)
              <input
                type="file"
                accept=".csv,.json,.txt,.pdf"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {parsed.length > 0 && (
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">Preview ({parsed.length} items)</h2>
          <p className="mb-3 text-sm text-stone-600">
            First 10 rows shown. All will be imported with next review set to today.
          </p>
          {type === 'vocab' && (
            <button
              type="button"
              onClick={handleLookupAll}
              disabled={lookupLoading}
              className="mb-3 rounded-md border border-stone-300 bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50"
            >
              {lookupLoading ? 'Looking up…' : 'Look up all (Jisho)'}
            </button>
          )}
          <ul className="mb-4 max-h-60 space-y-1 overflow-y-auto rounded border border-stone-100 bg-stone-50/50 p-2 text-sm">
            {parsed.slice(0, 10).map((row, i) => (
              <li key={i} className="flex gap-2">
                {row.grammar && <span>{row.grammar.title || '—'}</span>}
                {row.vocab && (
                  <span>
                    {row.vocab.word} {row.vocab.reading && `（${row.vocab.reading}）`} — {row.vocab.meaning || '—'}
                  </span>
                )}
                {row.sentence && (
                  <span>{row.sentence.japaneseText} → {row.sentence.translation}</span>
                )}
              </li>
            ))}
            {parsed.length > 10 && <li className="text-stone-500">… and {parsed.length - 10} more</li>}
          </ul>
          <button
            type="button"
            onClick={handleImport}
            className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
          >
            Confirm import
          </button>
        </div>
      )}

      {importDone && (
        <p className="rounded-lg bg-green-100 p-4 text-green-800">{importDone}</p>
      )}
    </div>
  )
}
