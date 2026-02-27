/**
 * API client for production: same logical interface as storage.ts but over HTTP.
 * All methods require a valid Clerk session token (getToken).
 */
import type { Grammar, Vocabulary, Sentence } from '../types';

function getBase(): string {
  const base = import.meta.env.VITE_API_BASE;
  return typeof base === 'string' && base.length > 0 ? base.replace(/\/$/, '') : '';
}

export function createApiClient(getToken: () => Promise<string | null>) {
  async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const base = getBase();
    const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  }

  async function checkRes(res: Response): Promise<void> {
    if (!res.ok) {
      const text = await res.text();
      let msg: string;
      try {
        const j = JSON.parse(text);
        msg = j.error ?? text;
      } catch {
        msg = text || res.statusText;
      }
      throw new Error(msg || `HTTP ${res.status}`);
    }
  }

  return {
    async getGrammar(): Promise<Grammar[]> {
      const res = await authFetch('/api/grammar');
      await checkRes(res);
      return res.json();
    },
    async getVocab(): Promise<Vocabulary[]> {
      const res = await authFetch('/api/vocab');
      await checkRes(res);
      return res.json();
    },
    async getSentences(): Promise<Sentence[]> {
      const res = await authFetch('/api/sentences');
      await checkRes(res);
      return res.json();
    },

    async createGrammar(partial: Omit<Grammar, 'id' | 'type' | 'created' | 'srs'>): Promise<Grammar> {
      const res = await authFetch('/api/grammar', {
        method: 'POST',
        body: JSON.stringify(partial),
      });
      await checkRes(res);
      return res.json();
    },
    async createVocab(partial: Omit<Vocabulary, 'id' | 'type' | 'created' | 'srs'>): Promise<Vocabulary> {
      const res = await authFetch('/api/vocab', {
        method: 'POST',
        body: JSON.stringify(partial),
      });
      await checkRes(res);
      return res.json();
    },
    async createSentence(partial: Omit<Sentence, 'id' | 'type' | 'created' | 'srs'>): Promise<Sentence> {
      const res = await authFetch('/api/sentences', {
        method: 'POST',
        body: JSON.stringify(partial),
      });
      await checkRes(res);
      return res.json();
    },

    async updateGrammar(id: string, updates: Partial<Grammar>): Promise<void> {
      const res = await authFetch(`/api/grammar/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      await checkRes(res);
    },
    async updateVocab(id: string, updates: Partial<Vocabulary>): Promise<void> {
      const res = await authFetch(`/api/vocab/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      await checkRes(res);
    },
    async updateSentence(id: string, updates: Partial<Sentence>): Promise<void> {
      const res = await authFetch(`/api/sentences/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      await checkRes(res);
    },

    async deleteGrammar(id: string): Promise<void> {
      const res = await authFetch(`/api/grammar/${id}`, { method: 'DELETE' });
      await checkRes(res);
    },
    async deleteVocab(id: string): Promise<void> {
      const res = await authFetch(`/api/vocab/${id}`, { method: 'DELETE' });
      await checkRes(res);
    },
    async deleteSentence(id: string): Promise<void> {
      const res = await authFetch(`/api/sentences/${id}`, { method: 'DELETE' });
      await checkRes(res);
    },

    async addGrammarBulk(
      items: Omit<Grammar, 'id' | 'type' | 'created' | 'srs'>[]
    ): Promise<Grammar[]> {
      const res = await authFetch('/api/grammar/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      await checkRes(res);
      return res.json();
    },
    async addVocabBulk(
      items: Omit<Vocabulary, 'id' | 'type' | 'created' | 'srs'>[]
    ): Promise<Vocabulary[]> {
      const res = await authFetch('/api/vocab/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      await checkRes(res);
      return res.json();
    },
    async addSentencesBulk(
      items: Omit<Sentence, 'id' | 'type' | 'created' | 'srs'>[]
    ): Promise<Sentence[]> {
      const res = await authFetch('/api/sentences/bulk', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      await checkRes(res);
      return res.json();
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
