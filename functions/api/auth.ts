/**
 * Verify Clerk session token and return user id (sub claim).
 * Uses JWKS from CLERK_ISSUER (e.g. https://xxx.clerk.accounts.dev).
 */
import * as jose from 'jose';

const ALLOWED_ORIGINS = [
  'https://japanese-learning-review.pages.dev',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function withCors(response: Response, request: Request): Response {
  const cors = getCorsHeaders(request);
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function corsPreflightResponse(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function getUserId(request: Request, env: { CLERK_ISSUER?: string }): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !env.CLERK_ISSUER) return null;

  try {
    const issuer = env.CLERK_ISSUER.replace(/\/$/, '');
    const jwks = jose.createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer,
      audience: (env as { CLERK_PUBLISHABLE_KEY?: string }).CLERK_PUBLISHABLE_KEY || undefined,
    });
    const sub = payload.sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

export function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}
