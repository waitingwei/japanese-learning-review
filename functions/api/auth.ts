/**
 * Verify Clerk session token and return user id (sub claim).
 * Uses JWKS from CLERK_ISSUER (e.g. https://xxx.clerk.accounts.dev).
 */
import * as jose from 'jose';

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
