import { createPublicKey, createVerify, timingSafeEqual } from 'node:crypto';

/**
 * Cloudflare Access authentication for the admin API.
 *
 * WHY THIS VERIFIES THE TOKEN RATHER THAN TRUSTING THE EDGE.
 * The obvious shortcut is to put an Access policy in front of the tunnel and
 * assume anything arriving at the origin is authenticated. That is wrong here:
 * nginx on this box listens on 0.0.0.0:80 and answers to `server_name
 * 192.168.1.58`, so anyone on the office network can reach the origin directly
 * without passing through Cloudflare at all. Enquiry rows are personal data,
 * so the service checks the signature itself and the edge policy is defence in
 * depth rather than the whole defence.
 *
 * Zero dependencies: Node can build a public key straight from a JWK, so JWKS
 * fetching and RS256 verification are a few lines rather than a library.
 */

const JWKS_TTL_MS = 60 * 60 * 1000;
let jwksCache = { keys: null, fetchedAt: 0, url: null };

const b64urlToBuffer = (input) =>
  Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const decodeJson = (segment) => JSON.parse(b64urlToBuffer(segment).toString('utf8'));

async function getKeys(teamDomain) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const fresh = Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (jwksCache.keys && fresh && jwksCache.url === url) return jwksCache.keys;

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`JWKS fetch failed: HTTP ${response.status}`);

  const { keys } = await response.json();
  if (!Array.isArray(keys) || keys.length === 0) throw new Error('JWKS contained no keys');

  jwksCache = { keys, fetchedAt: Date.now(), url };
  return keys;
}

/** Reads one cookie without taking a dependency for a single lookup. */
function readCookie(req, name) {
  const header = req.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

/** Constant-time string compare, so a mismatch leaks nothing through timing. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a Cloudflare Access JWT. Returns the caller's email, or throws.
 * Every failure path throws — there is no "couldn't check, so allow".
 */
export async function verifyAccessJwt(token, { teamDomain, audience }) {
  if (!token) throw new Error('no token');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = decodeJson(headerB64);
  // Pinning the algorithm defeats the classic "alg: none" and
  // RS256-downgraded-to-HS256 forgeries.
  if (header.alg !== 'RS256') throw new Error(`unexpected alg ${header.alg}`);

  const keys = await getKeys(teamDomain);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('signing key not found');

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const verified = createVerify('RSA-SHA256')
    .update(`${headerB64}.${payloadB64}`)
    .verify(publicKey, b64urlToBuffer(signatureB64));
  if (!verified) throw new Error('bad signature');

  const claims = decodeJson(payloadB64);
  const now = Math.floor(Date.now() / 1000);

  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('token expired');
  if (typeof claims.nbf === 'number' && claims.nbf > now + 60) throw new Error('token not yet valid');

  const expectedIssuer = `https://${teamDomain}`;
  if (!safeEqual(claims.iss ?? '', expectedIssuer)) throw new Error('wrong issuer');

  // `aud` ties the token to THIS application. Without it, a token minted for
  // any other app behind the same Access team would be accepted here.
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.some((entry) => safeEqual(entry ?? '', audience))) throw new Error('wrong audience');

  return { email: claims.email ?? 'unknown', subject: claims.sub ?? null };
}

/**
 * Express middleware. Fails closed in every direction:
 *
 *  - not configured        -> 503, the admin API simply does not work
 *  - no or invalid token   -> 403
 *
 * ADMIN_DEV_BYPASS exists so the page can be built locally without a
 * Cloudflare tenant. It is refused outright when NODE_ENV=production, so it
 * cannot be left switched on by accident on the box.
 */
export function requireAccess() {
  const teamDomain = process.env.ACCESS_TEAM_DOMAIN;
  const audience = process.env.ACCESS_AUD;
  const devBypass = process.env.ADMIN_DEV_BYPASS === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  if (devBypass && isProduction) {
    throw new Error(
      '[atlas-admin] ADMIN_DEV_BYPASS=true with NODE_ENV=production. ' +
        'That would publish every enquiry unauthenticated. Refusing to start.',
    );
  }

  return async (req, res, next) => {
    if (devBypass) {
      req.accessUser = { email: 'dev-bypass@localhost' };
      return next();
    }

    if (!teamDomain || !audience) {
      console.error('[atlas-admin] ACCESS_TEAM_DOMAIN / ACCESS_AUD not set — admin API disabled');
      return res.status(503).json({ ok: false, error: 'Admin access is not configured.' });
    }

    // Cloudflare injects the header on every proxied request; the cookie is a
    // fallback for a direct browser navigation. Parsed by hand rather than
    // pulling in cookie-parser for one lookup.
    const token = req.get('cf-access-jwt-assertion') || readCookie(req, 'CF_Authorization');

    try {
      req.accessUser = await verifyAccessJwt(token, { teamDomain, audience });
      return next();
    } catch (error) {
      console.warn(`[atlas-admin] rejected: ${error.message}`);
      return res.status(403).json({ ok: false, error: 'Not authorised.' });
    }
  };
}

export default requireAccess;
