// The Jisho API does not enable CORS. We call it through a same-origin proxy.
const JISHO_API = '/api/jisho'

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

  const doFetch = () => fetch(`${JISHO_API}?keyword=${encodeURIComponent(keyword)}`, { headers })

  let res: Response
  try {
    res = await doFetch()
    if (!res.ok && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 800))
      res = await doFetch()
    }
  } catch (e) {
    try {
      await new Promise((r) => setTimeout(r, 600))
      res = await doFetch()
    } catch {
      throw new JishoLookupError('Network error. Check your connection and try again.')
    }
  }

  if (!res.ok) {
    let msg: string
    try {
      const body = await res.json().catch(() => ({}))
      msg = typeof body?.error === 'string' ? body.error : res.statusText || `Request failed (${res.status})`
    } catch {
      msg = res.statusText || `Request failed (${res.status})`
    }
    if (res.status === 401) msg = 'Please sign in again.'
    if (res.status === 429) msg = 'Too many lookups. Please wait a moment and try again.'
    throw new JishoLookupError(msg)
  }

  let data: { data?: Array<unknown> }
  try {
    data = await res.json()
  } catch {
    throw new JishoLookupError('Invalid response from lookup service.')
  }

  const first = data.data?.[0] as { japanese?: Array<{ word?: string; reading?: string }>; senses?: Array<{ english_definitions?: string[] }> } | undefined
  if (!first) return null

  const reading =
    first.japanese?.[0]?.reading ??
    first.japanese?.[0]?.word ??
    ''
  const meaning =
    first.senses?.[0]?.english_definitions?.join(', ') ??
    ''
  const conjugation = parseConjugationFromJisho(first)
  return { reading, meaning, conjugation }
}

export function getJapanDictUrl(word: string): string {
  // JapanDict word search uses the `s=` query param.
  return `https://www.japandict.com/?s=${encodeURIComponent(word.trim())}&lang=eng&list=1`
}
