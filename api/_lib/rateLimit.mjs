/**
 * Simple in-memory rate limiter for Vercel serverless endpoints.
 *
 * LIMITATIONS (serverless):
 * - Each cold start has its own counter (bursts across instances are possible).
 * - For production with many concurrent users, use a Supabase-based rate
 *   limiter (insert into a rate_limits table with TTL cleanup).
 *
 * This catches the common case: rapid-fire requests from the same source
 * hitting the same instance in quick succession.
 */

const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const CLEANUP_INTERVAL_MS = 300000; // clean old entries every 5 minutes

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of requestCounts) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      requestCounts.delete(key);
    }
  }
}

/**
 * Check if a request is rate-limited.
 *
 * @param {string} key - Unique identifier (e.g., `ip:{clientIp}` or `user:{userId}`)
 * @param {object} options
 * @param {number} options.maxRequests - Max requests allowed in the window (default 30)
 * @param {number} options.windowMs - Time window in ms (default 60000)
 * @returns {{ limited: boolean, remaining: number, resetIn: number }}
 */
export function checkRateLimit(key, { maxRequests = 30, windowMs = RATE_LIMIT_WINDOW_MS } = {}) {
  cleanup();

  const now = Date.now();
  let entry = requestCounts.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 0 };
    requestCounts.set(key, entry);
  }

  entry.count += 1;
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);

  return {
    limited: entry.count > maxRequests,
    remaining,
    resetIn,
  };
}

/**
 * Extract a rate-limit key from the request (client IP or first auth identifier).
 * Falls back to a shared key if neither is available.
 */
export function rateLimitKeyFromRequest(req) {
  // Vercel sets this header; fall back to x-forwarded-for or a shared counter
  const ip =
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-vercel-forwarded-for'] ||
    'global';

  return `ip:${ip}`;
}