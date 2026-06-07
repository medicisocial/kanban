// Shared API response helpers — ensures consistent { ok, error, requestId } format
// across all endpoints. Use these instead of res.json() directly.

let requestCounter = 0;

/** Generate a unique request ID for observability */
export function generateRequestId() {
  requestCounter += 1;
  const ts = Date.now().toString(36);
  const seq = requestCounter.toString(36);
  return `req_${ts}_${seq}`;
}

/** 200 OK — successful operation with data */
export function ok(res, data = {}) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(200).json({ ok: true, ...data, requestId });
}

/** 201 Created — resource successfully created */
export function created(res, data = {}) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(201).json({ ok: true, ...data, requestId });
}

/** 204 No Content — successful delete/update with no body */
export function noContent(res) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(204).end();
}

/** 400 Bad Request — malformed input */
export function badRequest(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(400).json({ ok: false, error: String(message || 'Bad request.'), requestId });
}

/** 401 Unauthorized — missing or invalid authentication */
export function unauthorized(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(401).json({ ok: false, error: String(message || 'Unauthorized.'), requestId });
}

/** 403 Forbidden — valid auth but insufficient permissions */
export function forbidden(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(403).json({ ok: false, error: String(message || 'Forbidden.'), requestId });
}

/** 404 Not Found — resource doesn't exist */
export function notFound(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(404).json({ ok: false, error: String(message || 'Not found.'), requestId });
}

/** 405 Method Not Allowed — wrong HTTP method */
export function methodNotAllowed(res, allowedMethods) {
  const requestId = generateRequestId();
  res.setHeader('Allow', allowedMethods);
  res.setHeader('X-Request-Id', requestId);
  return res.status(405).json({ ok: false, error: `Method not allowed. Use ${allowedMethods}.`, requestId });
}

/** 409 Conflict — duplicate, version conflict */
export function conflict(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(409).json({ ok: false, error: String(message || 'Conflict.'), requestId });
}

/** 429 Too Many Requests — rate limit exceeded */
export function tooManyRequests(res, retryAfterSeconds = 15) {
  const requestId = generateRequestId();
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.setHeader('X-Request-Id', requestId);
  return res.status(429).json({
    ok: false,
    error: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
    retryAfter: retryAfterSeconds,
    requestId,
  });
}

/** 500 Internal Server Error — unexpected failure */
export function serverError(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(500).json({
    ok: false,
    error: String(message || 'Internal server error.'),
    requestId,
  });
}

/** 502 Bad Gateway — upstream service failure */
export function badGateway(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(502).json({ ok: false, error: String(message || 'Upstream service error.'), requestId });
}

/** 503 Service Unavailable — configuration/dependency missing */
export function unavailable(res, message) {
  const requestId = generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  return res.status(503).json({ ok: false, error: String(message || 'Service unavailable.'), requestId });
}