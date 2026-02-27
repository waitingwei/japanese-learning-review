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

/**
 * @param keyword - Word to look up on Jisho.
 * @param getToken - When using production API (VITE_USE_API), pass Clerk's getToken so the request is authenticated.
 */
export async function lookupJisho(
  keyword: string,
  getToken?: () => Promise<string | null>
): Promise<JishoResult | null> {
  try {
    const headers: HeadersInit = {}
    if (getToken) {
      const token = await getToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(`${JISHO_API}?keyword=${encodeURIComponent(keyword)}`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    const first = data.data?.[0]
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
  } catch {
    return null
  }
}

export function getJapanDictUrl(word: string): string {
  // JapanDict word search uses the `s=` query param.
  return `https://www.japandict.com/?s=${encodeURIComponent(word.trim())}&lang=eng&list=1`
}
