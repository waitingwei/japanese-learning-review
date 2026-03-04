import { neon } from '@neondatabase/serverless';
import { getUserId, jsonResponse, errorResponse, withCors, corsPreflightResponse } from './auth';

type Env = {
  NEON_DATABASE_URL: string;
  CLERK_ISSUER: string;
  CLERK_PUBLISHABLE_KEY?: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSRS() {
  return { nextReviewAt: todayISO(), interval: 0, easeFactor: 2.5 };
}

/** Read from row with either snake_case or camelCase key so driver/key shape doesn't hide data. */
function get(r: Record<string, unknown>, snake: string, camel?: string): unknown {
  const c = camel ?? snake.replace(/_([a-z])/g, (_, l) => (l as string).toUpperCase());
  return r[snake] ?? r[c];
}

/** If the driver returns rows as arrays (e.g. Neon HTTP), build an object from fields. */
function rowToObject(row: unknown, fields: { name: string }[]): Record<string, unknown> {
  if (row == null) return {};
  if (!Array.isArray(row)) return row as Record<string, unknown>;
  const o: Record<string, unknown> = {};
  fields.forEach((f, i) => {
    o[f.name] = row[i];
  });
  return o;
}

// Map DB row to frontend shape (camelCase, created -> created, srs object)
function rowToGrammar(r: Record<string, unknown>) {
  const nextReviewAt = get(r, 'next_review_at');
  return {
    id: r.id,
    type: 'grammar',
    title: get(r, 'title') ?? '',
    explanation: get(r, 'explanation') ?? '',
    exampleSentence: get(r, 'example_sentence') ?? '',
    exampleTranslation: get(r, 'example_translation') ?? '',
    lesson: get(r, 'lesson') ?? '',
    created: ((get(r, 'created_at') as string)?.replace?.('Z', '') as string) ?? new Date().toISOString(),
    srs: nextReviewAt
      ? {
          nextReviewAt: (nextReviewAt as string).toString().slice(0, 10),
          interval: Number(get(r, 'interval_days') ?? 0),
          easeFactor: Number(get(r, 'ease_factor') ?? 2.5),
        }
      : undefined,
  };
}

function rowToVocab(r: Record<string, unknown>) {
  const nextReviewAt = get(r, 'next_review_at');
  return {
    id: r.id,
    type: 'vocab',
    word: get(r, 'word') ?? '',
    reading: get(r, 'reading') ?? '',
    meaning: get(r, 'meaning') ?? '',
    exampleSentence: get(r, 'example_sentence') ?? '',
    lesson: get(r, 'lesson') ?? '',
    conjugationSummary: get(r, 'conjugation_summary') ?? undefined,
    conjugation: (get(r, 'conjugation') as object) ?? undefined,
    created: ((get(r, 'created_at') as string)?.replace?.('Z', '') as string) ?? new Date().toISOString(),
    srs: nextReviewAt
      ? {
          nextReviewAt: (nextReviewAt as string).toString().slice(0, 10),
          interval: Number(get(r, 'interval_days') ?? 0),
          easeFactor: Number(get(r, 'ease_factor') ?? 2.5),
        }
      : undefined,
  };
}

function rowToSentence(r: Record<string, unknown>) {
  const nextReviewAt = get(r, 'next_review_at');
  return {
    id: r.id,
    type: 'sentence',
    japaneseText: get(r, 'japanese_text') ?? '',
    translation: get(r, 'translation') ?? '',
    linkedGrammar: get(r, 'linked_grammar') ?? undefined,
    lesson: get(r, 'lesson') ?? '',
    created: ((get(r, 'created_at') as string)?.replace?.('Z', '') as string) ?? new Date().toISOString(),
    srs: nextReviewAt
      ? {
          nextReviewAt: (nextReviewAt as string).toString().slice(0, 10),
          interval: Number(get(r, 'interval_days') ?? 0),
          easeFactor: Number(get(r, 'ease_factor') ?? 2.5),
        }
      : undefined,
  };
}

async function handleGrammar(
  method: string,
  path: string[],
  request: Request,
  sql: ReturnType<typeof neon>,
  userId: string
): Promise<Response> {
  const id = path[1];
  const isBulk = path[1] === 'bulk';
  if (method === 'GET' && !id) {
    const result = await (sql as { query: (q: string, p?: unknown[], o?: { fullResults?: boolean }) => Promise<{ rows: unknown[]; fields: { name: string }[] }> }).query(
      'SELECT * FROM grammar WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
      { fullResults: true }
    );
    const rows = result.rows.map((row) => rowToObject(row, result.fields));
    return jsonResponse(rows.map((r) => rowToGrammar(r)));
  }
  if (method === 'POST' && isBulk) {
    const body = (await request.json()) as { items: Record<string, unknown>[] };
    const items = Array.isArray(body.items) ? body.items : [];
    const srs = defaultSRS();
    const created: unknown[] = [];
    for (const it of items) {
      const [row] = await sql`
        INSERT INTO grammar (user_id, type, title, explanation, example_sentence, example_translation, lesson, next_review_at, interval_days, ease_factor)
        VALUES (${userId}, 'grammar', ${String(it.title ?? '')}, ${String(it.explanation ?? '')}, ${String(it.exampleSentence ?? '')}, ${String(it.exampleTranslation ?? '')}, ${String(it.lesson ?? '')}, ${srs.nextReviewAt}, ${srs.interval}, ${srs.easeFactor})
        RETURNING *
      `;
      if (row) created.push(rowToGrammar(row as Record<string, unknown>));
    }
    return jsonResponse(created, 201);
  }
  if (method === 'POST' && !id) {
    const body = (await request.json()) as Record<string, unknown>;
    const srs = defaultSRS();
    const [row] = await sql`
      INSERT INTO grammar (user_id, type, title, explanation, example_sentence, example_translation, lesson, next_review_at, interval_days, ease_factor)
      VALUES (${userId}, 'grammar', ${String(body.title ?? '')}, ${String(body.explanation ?? '')}, ${String(body.exampleSentence ?? '')}, ${String(body.exampleTranslation ?? '')}, ${String(body.lesson ?? '')}, ${srs.nextReviewAt}, ${srs.interval}, ${srs.easeFactor})
      RETURNING *
    `;
    return jsonResponse(rowToGrammar(row as Record<string, unknown>), 201);
  }
  if ((method === 'PATCH' || method === 'DELETE') && id && !isBulk) {
    if (method === 'PATCH') {
      const body = (await request.json()) as Record<string, unknown>;
      const title = String(body.title ?? '');
      const explanation = String(body.explanation ?? '');
      const exampleSentence = String(body.exampleSentence ?? '');
      const exampleTranslation = String(body.exampleTranslation ?? '');
      const lesson = String(body.lesson ?? '');
      const srs = body.srs as { nextReviewAt?: string; interval?: number; easeFactor?: number } | undefined;
      const nextReviewAt = srs?.nextReviewAt ?? todayISO();
      const intervalDays = srs?.interval ?? 0;
      const easeFactor = srs?.easeFactor ?? 2.5;
      const rows = await sql`
        UPDATE grammar
        SET title = ${title}, explanation = ${explanation}, example_sentence = ${exampleSentence},
            example_translation = ${exampleTranslation}, lesson = ${lesson},
            next_review_at = ${nextReviewAt}, interval_days = ${intervalDays}, ease_factor = ${easeFactor}
        WHERE id = ${id}::uuid AND user_id = ${userId}
        RETURNING *
      `;
      const row = Array.isArray(rows) ? rows[0] : (rows as unknown as Record<string, unknown>[])?.[0];
      if (!row) return errorResponse('Not found', 404);
      return jsonResponse(rowToGrammar(row));
    }
    const rows = await sql`DELETE FROM grammar WHERE id = ${id}::uuid AND user_id = ${userId} RETURNING id`;
    return Array.isArray(rows) && rows.length > 0 ? jsonResponse({ ok: true }) : errorResponse('Not found', 404);
  }
  return errorResponse('Method not allowed', 405);
}

async function handleVocab(
  method: string,
  path: string[],
  request: Request,
  sql: ReturnType<typeof neon>,
  userId: string
): Promise<Response> {
  const id = path[1];
  const isBulk = path[1] === 'bulk';
  if (method === 'GET' && !id) {
    const result = await (sql as { query: (q: string, p?: unknown[], o?: { fullResults?: boolean }) => Promise<{ rows: unknown[]; fields: { name: string }[] }> }).query(
      'SELECT * FROM vocab WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
      { fullResults: true }
    );
    const rows = result.rows.map((row) => rowToObject(row, result.fields));
    return jsonResponse(rows.map((r) => rowToVocab(r)));
  }
  if (method === 'POST' && isBulk) {
    const body = (await request.json()) as { items: Record<string, unknown>[] };
    const items = Array.isArray(body.items) ? body.items : [];
    const srs = defaultSRS();
    const created: unknown[] = [];
    for (const it of items) {
      const conj = it.conjugation != null ? JSON.stringify(it.conjugation) : null;
      const [row] = await sql`
        INSERT INTO vocab (user_id, type, word, reading, meaning, example_sentence, lesson, conjugation_summary, conjugation, next_review_at, interval_days, ease_factor)
        VALUES (${userId}, 'vocab', ${String(it.word ?? '')}, ${String(it.reading ?? '')}, ${String(it.meaning ?? '')}, ${String(it.exampleSentence ?? '')}, ${String(it.lesson ?? '')}, ${it.conjugationSummary ?? null}, ${conj}, ${srs.nextReviewAt}, ${srs.interval}, ${srs.easeFactor})
        RETURNING *
      `;
      if (row) created.push(rowToVocab(row as Record<string, unknown>));
    }
    return jsonResponse(created, 201);
  }
  if (method === 'POST' && !id) {
    const body = (await request.json()) as Record<string, unknown>;
    const srs = defaultSRS();
    const conj = body.conjugation != null ? JSON.stringify(body.conjugation) : null;
    const [row] = await sql`
      INSERT INTO vocab (user_id, type, word, reading, meaning, example_sentence, lesson, conjugation_summary, conjugation, next_review_at, interval_days, ease_factor)
      VALUES (${userId}, 'vocab', ${String(body.word ?? '')}, ${String(body.reading ?? '')}, ${String(body.meaning ?? '')}, ${String(body.exampleSentence ?? '')}, ${String(body.lesson ?? '')}, ${body.conjugationSummary ?? null}, ${conj}, ${srs.nextReviewAt}, ${srs.interval}, ${srs.easeFactor})
      RETURNING *
    `;
    return jsonResponse(rowToVocab(row as Record<string, unknown>), 201);
  }
  if ((method === 'PATCH' || method === 'DELETE') && id && !isBulk) {
    if (method === 'PATCH') {
      const body = (await request.json()) as Record<string, unknown>;
      const word = String(body.word ?? '');
      const reading = String(body.reading ?? '');
      const meaning = String(body.meaning ?? '');
      const exampleSentence = String(body.exampleSentence ?? '');
      const lesson = String(body.lesson ?? '');
      const conjugationSummary = body.conjugationSummary != null ? String(body.conjugationSummary) : null;
      const conjugation = body.conjugation != null ? JSON.stringify(body.conjugation) : null;
      const srs = body.srs as { nextReviewAt?: string; interval?: number; easeFactor?: number } | undefined;
      const nextReviewAt = srs?.nextReviewAt ?? todayISO();
      const intervalDays = srs?.interval ?? 0;
      const easeFactor = srs?.easeFactor ?? 2.5;
      const rows = await sql`
        UPDATE vocab
        SET word = ${word}, reading = ${reading}, meaning = ${meaning}, example_sentence = ${exampleSentence},
            lesson = ${lesson}, conjugation_summary = ${conjugationSummary}, conjugation = ${conjugation}::jsonb,
            next_review_at = ${nextReviewAt}, interval_days = ${intervalDays}, ease_factor = ${easeFactor}
        WHERE id = ${id}::uuid AND user_id = ${userId}
        RETURNING *
      `;
      const row = Array.isArray(rows) ? rows[0] : (rows as unknown as Record<string, unknown>[])?.[0];
      if (!row) return errorResponse('Not found', 404);
      return jsonResponse(rowToVocab(row));
    }
    const rows = await sql`DELETE FROM vocab WHERE id = ${id}::uuid AND user_id = ${userId} RETURNING id`;
    return Array.isArray(rows) && rows.length > 0 ? jsonResponse({ ok: true }) : errorResponse('Not found', 404);
  }
  return errorResponse('Method not allowed', 405);
}

async function handleSentences(
  method: string,
  path: string[],
  request: Request,
  sql: ReturnType<typeof neon>,
  userId: string
): Promise<Response> {
  const id = path[1];
  const isBulk = path[1] === 'bulk';
  if (method === 'GET' && !id) {
    const result = await (sql as { query: (q: string, p?: unknown[], o?: { fullResults?: boolean }) => Promise<{ rows: unknown[]; fields: { name: string }[] }> }).query(
      'SELECT * FROM sentences WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
      { fullResults: true }
    );
    const rows = result.rows.map((row) => rowToObject(row, result.fields));
    return jsonResponse(rows.map((r) => rowToSentence(r)));
  }
  if (method === 'POST' && isBulk) {
    const body = (await request.json()) as { items: Record<string, unknown>[] };
    const items = Array.isArray(body.items) ? body.items : [];
    const srs = defaultSRS();
    const created: unknown[] = [];
    for (const it of items) {
      const [row] = await sql`
        INSERT INTO sentences (user_id, type, japanese_text, translation, linked_grammar, lesson, next_review_at, interval_days, ease_factor)
        VALUES (${userId}, 'sentence', ${String(it.japaneseText ?? '')}, ${String(it.translation ?? '')}, ${it.linkedGrammar ?? null}, ${String(it.lesson ?? '')}, ${srs.nextReviewAt}, ${srs.interval}, ${srs.easeFactor})
        RETURNING *
      `;
      if (row) created.push(rowToSentence(row as Record<string, unknown>));
    }
    return jsonResponse(created, 201);
  }
  if (method === 'POST' && !id) {
    const body = (await request.json()) as Record<string, unknown>;
    const srs = defaultSRS();
    const [row] = await sql`
      INSERT INTO sentences (user_id, type, japanese_text, translation, linked_grammar, lesson, next_review_at, interval_days, ease_factor)
      VALUES (${userId}, 'sentence', ${String(body.japaneseText ?? '')}, ${String(body.translation ?? '')}, ${body.linkedGrammar ?? null}, ${String(body.lesson ?? '')}, ${srs.nextReviewAt}, ${srs.interval}, ${srs.easeFactor})
      RETURNING *
    `;
    return jsonResponse(rowToSentence(row as Record<string, unknown>), 201);
  }
  if ((method === 'PATCH' || method === 'DELETE') && id && !isBulk) {
    if (method === 'PATCH') {
      const body = (await request.json()) as Record<string, unknown>;
      const japaneseText = String(body.japaneseText ?? '');
      const translation = String(body.translation ?? '');
      const linkedGrammar = body.linkedGrammar != null ? String(body.linkedGrammar) : null;
      const lesson = String(body.lesson ?? '');
      const srs = body.srs as { nextReviewAt?: string; interval?: number; easeFactor?: number } | undefined;
      const nextReviewAt = srs?.nextReviewAt ?? todayISO();
      const intervalDays = srs?.interval ?? 0;
      const easeFactor = srs?.easeFactor ?? 2.5;
      const rows = await sql`
        UPDATE sentences
        SET japanese_text = ${japaneseText}, translation = ${translation}, linked_grammar = ${linkedGrammar},
            lesson = ${lesson}, next_review_at = ${nextReviewAt}, interval_days = ${intervalDays}, ease_factor = ${easeFactor}
        WHERE id = ${id}::uuid AND user_id = ${userId}
        RETURNING *
      `;
      const row = Array.isArray(rows) ? rows[0] : (rows as unknown as Record<string, unknown>[])?.[0];
      if (!row) return errorResponse('Not found', 404);
      return jsonResponse(rowToSentence(row));
    }
    const rows = await sql`DELETE FROM sentences WHERE id = ${id}::uuid AND user_id = ${userId} RETURNING id`;
    return Array.isArray(rows) && rows.length > 0 ? jsonResponse({ ok: true }) : errorResponse('Not found', 404);
  }
  return errorResponse('Method not allowed', 405);
}

async function handleJisho(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword');
  if (!keyword) return errorResponse('Missing keyword', 400);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) return errorResponse('Jisho rate limit. Please try again in a moment.', 429);
      return errorResponse(text || `Jisho returned ${res.status}`, res.status >= 500 ? 502 : res.status);
    }

    const data = await res.json();
    return jsonResponse(data);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === 'AbortError') return errorResponse('Lookup timed out. Try again.', 504);
      return errorResponse(err.message || 'Lookup failed', 502);
    }
    return errorResponse('Lookup failed', 502);
  }
}

export async function onRequestOptions(context: { request: Request; env: Env }) {
  return corsPreflightResponse(context.request);
}

export async function onRequestGet(context: { request: Request; env: Env; params: { path?: string[] } }) {
  const res = await handleRequest('GET', context);
  return withCors(res, context.request);
}

export async function onRequestPost(context: { request: Request; env: Env; params: { path?: string[] } }) {
  const res = await handleRequest('POST', context);
  return withCors(res, context.request);
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { path?: string[] } }) {
  const res = await handleRequest('PATCH', context);
  return withCors(res, context.request);
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { path?: string[] } }) {
  const res = await handleRequest('DELETE', context);
  return withCors(res, context.request);
}

async function handleRequest(
  method: string,
  context: { request: Request; env: Env; params: { path?: string[] } }
): Promise<Response> {
  const path = context.params.path ?? [];
  const env = context.env as Env;
  if (!env.NEON_DATABASE_URL) return errorResponse('Server misconfiguration', 500);

  // Jisho proxy: require auth
  if (path[0] === 'jisho') {
    const userId = await getUserId(context.request, env);
    if (!userId) return errorResponse('Unauthorized', 401);
    return handleJisho(context.request);
  }

  const userId = await getUserId(context.request, env);
  if (!userId) return errorResponse('Unauthorized', 401);

  const sql = neon(env.NEON_DATABASE_URL);

  switch (path[0]) {
    case 'grammar':
      return handleGrammar(method, path, context.request, sql, userId);
    case 'vocab':
      return handleVocab(method, path, context.request, sql, userId);
    case 'sentences':
      return handleSentences(method, path, context.request, sql, userId);
    default:
      return errorResponse('Not found', 404);
  }
}
