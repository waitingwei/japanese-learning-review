import { neon } from '@neondatabase/serverless';
import { getUserId, jsonResponse, errorResponse } from './auth';

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

// Map DB row to frontend shape (camelCase, created -> created, srs object)
function rowToGrammar(r: Record<string, unknown>) {
  return {
    id: r.id,
    type: 'grammar',
    title: r.title,
    explanation: r.explanation ?? '',
    exampleSentence: r.example_sentence ?? '',
    exampleTranslation: r.example_translation ?? '',
    lesson: r.lesson ?? '',
    created: (r.created_at as string)?.replace?.('Z', '') ?? new Date().toISOString(),
    srs: r.next_review_at
      ? {
          nextReviewAt: (r.next_review_at as string).toString().slice(0, 10),
          interval: Number(r.interval_days ?? 0),
          easeFactor: Number(r.ease_factor ?? 2.5),
        }
      : undefined,
  };
}

function rowToVocab(r: Record<string, unknown>) {
  return {
    id: r.id,
    type: 'vocab',
    word: r.word,
    reading: r.reading ?? '',
    meaning: r.meaning ?? '',
    exampleSentence: r.example_sentence ?? '',
    lesson: r.lesson ?? '',
    conjugationSummary: r.conjugation_summary ?? undefined,
    conjugation: (r.conjugation as object) ?? undefined,
    created: (r.created_at as string)?.replace?.('Z', '') ?? new Date().toISOString(),
    srs: r.next_review_at
      ? {
          nextReviewAt: (r.next_review_at as string).toString().slice(0, 10),
          interval: Number(r.interval_days ?? 0),
          easeFactor: Number(r.ease_factor ?? 2.5),
        }
      : undefined,
  };
}

function rowToSentence(r: Record<string, unknown>) {
  return {
    id: r.id,
    type: 'sentence',
    japaneseText: r.japanese_text,
    translation: r.translation ?? '',
    linkedGrammar: r.linked_grammar ?? undefined,
    lesson: r.lesson ?? '',
    created: (r.created_at as string)?.replace?.('Z', '') ?? new Date().toISOString(),
    srs: r.next_review_at
      ? {
          nextReviewAt: (r.next_review_at as string).toString().slice(0, 10),
          interval: Number(r.interval_days ?? 0),
          easeFactor: Number(r.ease_factor ?? 2.5),
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
    const rows = await sql`SELECT * FROM grammar WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return jsonResponse(rows.map(rowToGrammar));
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
      const parts: string[] = ['UPDATE grammar SET '];
      const vals: unknown[] = [];
      if (body.title !== undefined) {
        parts.push('title = ', ', ');
        vals.push(body.title);
      }
      if (body.explanation !== undefined) {
        parts.push('explanation = ', ', ');
        vals.push(body.explanation);
      }
      if (body.exampleSentence !== undefined) {
        parts.push('example_sentence = ', ', ');
        vals.push(body.exampleSentence);
      }
      if (body.exampleTranslation !== undefined) {
        parts.push('example_translation = ', ', ');
        vals.push(body.exampleTranslation);
      }
      if (body.lesson !== undefined) {
        parts.push('lesson = ', ', ');
        vals.push(body.lesson);
      }
      if (body.srs !== undefined) {
        const s = body.srs as { nextReviewAt?: string; interval?: number; easeFactor?: number };
        parts.push('next_review_at = ', ', interval_days = ', ', ease_factor = ', ', ');
        vals.push(s.nextReviewAt ?? todayISO(), s.interval ?? 0, s.easeFactor ?? 2.5);
      }
      if (vals.length === 0) return jsonResponse({});
      parts[parts.length - 1] = parts[parts.length - 1].replace(/,\s*$/, '');
      parts.push(' WHERE id = ', '::uuid AND user_id = ', ' RETURNING *');
      vals.push(id, userId);
      const template = Object.assign(parts, { raw: parts }) as TemplateStringsArray;
      const rows = await (sql as (s: TemplateStringsArray, ...v: unknown[]) => Promise<Record<string, unknown>[]>)(
        template,
        ...vals
      );
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
    const rows = await sql`SELECT * FROM vocab WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return jsonResponse(rows.map(rowToVocab));
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
      const parts: string[] = ['UPDATE vocab SET '];
      const vals: unknown[] = [];
      const fields: [string, string][] = [
        ['word', 'word'],
        ['reading', 'reading'],
        ['meaning', 'meaning'],
        ['exampleSentence', 'example_sentence'],
        ['lesson', 'lesson'],
        ['conjugationSummary', 'conjugation_summary'],
      ];
      for (const [k, col] of fields) {
        if (body[k] !== undefined) {
          parts.push(`${col} = `, ', ');
          vals.push(body[k]);
        }
      }
      if (body.conjugation !== undefined) {
        parts.push('conjugation = ', '::jsonb, ');
        vals.push(JSON.stringify(body.conjugation));
      }
      if (body.srs !== undefined) {
        const s = body.srs as { nextReviewAt?: string; interval?: number; easeFactor?: number };
        parts.push('next_review_at = ', ', interval_days = ', ', ease_factor = ', ', ');
        vals.push(s.nextReviewAt ?? todayISO(), s.interval ?? 0, s.easeFactor ?? 2.5);
      }
      if (vals.length === 0) return jsonResponse({});
      parts[parts.length - 1] = parts[parts.length - 1].replace(/,\s*$/, '');
      parts.push(' WHERE id = ', '::uuid AND user_id = ', ' RETURNING *');
      vals.push(id, userId);
      const template = Object.assign(parts, { raw: parts }) as TemplateStringsArray;
      const rows = await (sql as (s: TemplateStringsArray, ...v: unknown[]) => Promise<Record<string, unknown>[]>)(
        template,
        ...vals
      );
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
    const rows = await sql`SELECT * FROM sentences WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return jsonResponse(rows.map(rowToSentence));
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
      const parts: string[] = ['UPDATE sentences SET '];
      const vals: unknown[] = [];
      if (body.japaneseText !== undefined) {
        parts.push('japanese_text = ', ', ');
        vals.push(body.japaneseText);
      }
      if (body.translation !== undefined) {
        parts.push('translation = ', ', ');
        vals.push(body.translation);
      }
      if (body.linkedGrammar !== undefined) {
        parts.push('linked_grammar = ', ', ');
        vals.push(body.linkedGrammar);
      }
      if (body.lesson !== undefined) {
        parts.push('lesson = ', ', ');
        vals.push(body.lesson);
      }
      if (body.srs !== undefined) {
        const s = body.srs as { nextReviewAt?: string; interval?: number; easeFactor?: number };
        parts.push('next_review_at = ', ', interval_days = ', ', ease_factor = ', ', ');
        vals.push(s.nextReviewAt ?? todayISO(), s.interval ?? 0, s.easeFactor ?? 2.5);
      }
      if (vals.length === 0) return jsonResponse({});
      parts[parts.length - 1] = parts[parts.length - 1].replace(/,\s*$/, '');
      parts.push(' WHERE id = ', '::uuid AND user_id = ', ' RETURNING *');
      vals.push(id, userId);
      const template = Object.assign(parts, { raw: parts }) as TemplateStringsArray;
      const rows = await (sql as (s: TemplateStringsArray, ...v: unknown[]) => Promise<Record<string, unknown>[]>)(
        template,
        ...vals
      );
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
  const res = await fetch(
    `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`
  );
  const data = await res.json();
  return jsonResponse(data);
}

export async function onRequestGet(context: { request: Request; env: Env; params: { path?: string[] } }) {
  return handleRequest('GET', context);
}

export async function onRequestPost(context: { request: Request; env: Env; params: { path?: string[] } }) {
  return handleRequest('POST', context);
}

export async function onRequestPatch(context: { request: Request; env: Env; params: { path?: string[] } }) {
  return handleRequest('PATCH', context);
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { path?: string[] } }) {
  return handleRequest('DELETE', context);
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
