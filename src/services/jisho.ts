// The Jisho API does not enable CORS. We call it through a same-origin proxy, with CORS-proxy fallback on 525/5xx.
const JISHO_API = '/api/jisho'
const JISHO_DIRECT_URL = 'https://jisho.org/api/v1/search/words'
const CORS_PROXY_PREFIX = 'https://api.allorigins.win/raw?url='

/** Conjugation fields we may parse from API or leave empty for manual entry. */
export interface JishoConjugation {
  present?: string
  negative?: string
  past?: string
  pastNegative?: string
  teForm?: string
  taiForm?: string
}

export interface JishoResult {
  reading: string
  meaning: string
  /** Verb conjugation forms; Jisho API does not expose these, so usually empty. Filled manually or by a future source. */
  conjugation?: JishoConjugation
}

/**
 * Attempt to parse conjugation-like variants from Jisho response.
 * Jisho does not document or expose verb conjugation tables; we return undefined so fields stay editable for manual entry.
 * If a future source (e.g. another API) provides conjugations, parse them here and return JishoConjugation.
 */
function parseConjugationFromJisho(_first: { japanese?: Array<{ word?: string; reading?: string }> }): JishoConjugation | undefined {
  return undefined
}
function parseJishoData(data: { data?: Array<unknown> }): JishoResult | null {
  const first = data.data?.[0] as { japanese?: Array<{ word?: string; reading?: string }>; senses?: Array<{ english_definitions?: string[] }> } | undefined
  if (!first) return null
  const reading = first.japanese?.[0]?.reading ?? first.japanese?.[0]?.word ?? ''
  const meaning = first.senses?.[0]?.english_definitions?.join(', ') ?? ''
  const conjugation = parseConjugationFromJisho(first)
  return { reading, meaning, conjugation }
}

/** Thrown when lookup fails (network, auth, rate limit, timeout). Use message for UI. */
export class JishoLookupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JishoLookupError'
  }
}

/**
 * @param keyword - Word to look up on Jisho.
 * @param getToken - When using production API (VITE_USE_API), pass Clerk's getToken so the request is authenticated.
 * @returns Result or null if word not found. Throws JishoLookupError on network/auth/rate-limit errors.
 */
export async function lookupJisho(
  keyword: string,
  getToken?: () => Promise<string | null>
): Promise<JishoResult | null> {
  const headers: HeadersInit = {}
  if (getToken) {
    try {
      const token = await getToken()
      if (token) headers.Authorization = `Bearer ${token}`
    } catch (e) {
      throw new JishoLookupError('Session expired. Please sign in again.')
    }
  }

  const RETRY_DELAY_MS = 600
  const doProxyFetch = () => fetch(`${JISHO_API}?keyword=${encodeURIComponent(keyword)}`, { headers })

  let res: Response
  try {
    res = await doProxyFetch()
    for (let retry = 0; retry < 2 && !res.ok && (res.status >= 500 || res.status === 525); retry++) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      res = await doProxyFetch()
    }
  } catch (e) {
    try {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      res = await doProxyFetch()
    } catch {
      throw new JishoLookupError('Network error. Check your connection and try again.')
    }
  }

  if (!res.ok) {
    const isUnavailable = res.status === 525 || (res.status >= 502 && res.status <= 504)
    if (isUnavailable) {
      try {
        const fallback = await fetch(
          CORS_PROXY_PREFIX + encodeURIComponent(`${JISHO_DIRECT_URL}?keyword=${encodeURIComponent(keyword)}`)
        )
        if (fallback.ok) {
          const text = await fallback.text()
          const data = JSON.parse(text) as { data?: Array<unknown> }
          const result = parseJishoData(data)
          if (result !== null) return result
        }
      } catch {
        // fallback failed, show message below
      }
    }
    let msg: string
    try {
      const body = await res.json().catch(() => ({}))
      msg = typeof body?.error === 'string' ? body.error : res.statusText || `Request failed (${res.status})`
    } catch {
      msg = res.statusText || `Request failed (${res.status})`
    }
    if (res.status === 401) msg = 'Please sign in again.'
    if (res.status === 429) msg = 'Too many lookups. Please wait a moment and try again.'
    if (res.status === 525) msg = 'Lookup service temporarily unavailable. Please try again in a moment.'
    if (res.status >= 502 && res.status <= 504) msg = 'Lookup service is temporarily unavailable. Please try again in a moment.'
    throw new JishoLookupError(msg)
  }

  let data: { data?: Array<unknown> }
  try {
    data = await res.json()
  } catch {
    throw new JishoLookupError('Invalid response from lookup service.')
  }

  return parseJishoData(data)
}

export function getJapanDictUrl(word: string): string {
  // JapanDict word search uses the `s=` query param.
  return `https://www.japandict.com/?s=${encodeURIComponent(word.trim())}&lang=eng&list=1`
}
