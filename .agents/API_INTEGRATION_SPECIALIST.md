# API Integration Specialist — Generalized Skill File

> Focus: API design patterns, integration strategies, error handling, idempotency, pagination, webhooks, rate limiting, versioning, and observability — applicable to any SaaS application.

---

## 1. API Design Principles

### RESTful Resource Design

```
Resources (nouns), not actions (verbs)
✓ GET    /users          → List users
✓ GET    /users/:id      → Get one user
✓ POST   /users          → Create user
✓ PUT    /users/:id      → Replace user
✓ PATCH  /users/:id      → Partial update
✓ DELETE /users/:id      → Delete user

✗ GET    /getUsers       → Verb in URL
✗ POST   /deleteUser     → Action as endpoint
✗ GET    /users?id=123   → Filter by PK in query string
```

### URL Structure Conventions

```
/api/v1/{resource}
/api/v1/{resource}/{id}
/api/v1/{resource}/{id}/{subresource}
/api/v1/{resource}?page=1&per_page=20&sort=-created_at&filter[status]=active

Always:   Plural nouns, lowercase, kebab-case
Always:   Version prefix (/v1/, /v2/)
Avoid:    Deep nesting past 3 levels (use query params or JSON:API includes)
```

### HTTP Methods & Semantics

| Method | Idempotent | Safe | Use Case |
|---|---|---|---|
| GET | ✓ | ✓ | Read data, no side effects |
| POST | ✗ | ✗ | Create, trigger action |
| PUT | ✓ | ✗ | Full replace (client provides all fields) |
| PATCH | ✓* | ✗ | Partial update (only changed fields) |
| DELETE | ✓ | ✗ | Remove resource |
| HEAD | ✓ | ✓ | Metadata only (headers, no body) |
| OPTIONS | ✓ | ✓ | CORS preflight, discover allowed methods |

> *PATCH is technically not guaranteed idempotent — implement it as idempotent by design.

---

## 2. Error Handling Patterns

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is not a valid format.",
    "details": [
      { "field": "email", "code": "invalid_format", "value": "not-an-email" }
    ],
    "requestId": "req_abc123",
    "docs": "https://docs.example.com/errors#VALIDATION_ERROR"
  }
}
```

### HTTP Status Code Quick Reference

| Code | Meaning | When to Use |
|---|---|---|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST (resource created) |
| 202 | Accepted | Async operation started (queue, webhook) |
| 204 | No Content | Successful DELETE, or update with no body |
| 301 | Moved Permanently | Resource has new canonical URL |
| 400 | Bad Request | Malformed input, validation error |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Valid auth but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate, version conflict, race condition |
| 410 | Gone | Resource intentionally removed (different from 404) |
| 422 | Unprocessable Entity | Semantic validation failure (past syntax) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server failure |
| 502 | Bad Gateway | Upstream service unreachable |
| 503 | Service Unavailable | Temporary maintenance / overload |
| 504 | Gateway Timeout | Upstream service timed out |

### Error Handling Rules

```
1. Always return structured JSON errors (never HTML or plain text)
2. Include a unique requestId/correlationId in every error
3. Never expose stack traces in production
4. Never reveal implementation details ("password too weak" → "Invalid credentials")
5. Validation errors: list ALL field errors, not just the first
6. 500 errors: log full details server-side, return generic message
7. Rate limit errors: include Retry-After header
```

---

## 3. Pagination

### Cursor-Based (Recommended for most APIs)

```json
// Request
GET /api/v1/users?cursor=eyJpZCI6MX0&limit=20

// Response
{
  "data": [ ... ],
  "pagination": {
    "nextCursor": "eyJpZCI6MjF9",
    "hasMore": true
  }
}
```

**Pros:** Stable results (new inserts don't shift pages), works with realtime data
**Cons:** Cannot jump to arbitrary page, harder to implement

### Offset-Based (Simple, traditional)

```json
// Request
GET /api/v1/users?page=1&per_page=20

// Response
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalPages": 50,
    "totalCount": 1000
  }
}
```

**Pros:** Simple, can jump to any page, easy to understand
**Cons:** Stale results (new inserts shift pages), performance degrades at high offsets

### Pagination Rules

```
Always return:    data[] + pagination metadata
Always require:   explicit limit/per_page (never unbounded)
Maximum default:  per_page = 20
Maximum cap:      per_page = 100
Never use:        cursor + page together (pick one)
```

---

## 4. Rate Limiting

### Header Convention

```
RateLimit-Limit:     100           // requests per window
RateLimit-Remaining: 42            // remaining in current window
RateLimit-Reset:     1700000000    // epoch seconds when window resets
Retry-After:         15            // seconds to wait (for 429 responses)
```

### Implementation Strategies

| Strategy | How It Works | Best For |
|---|---|---|
| **Fixed Window** | Reset counter every N seconds | Simple, easy to understand |
| **Sliding Window** | Rolling time window per user | More accurate rate limiting |
| **Token Bucket** | Tokens refill at fixed rate | Burst-tolerant APIs |
| **Concurrency** | Max in-flight requests | Long-running operations |

### Rate Limit Keys

```
User-level:     user:{userId}:{endpoint}
IP-level:       ip:{clientIp}
Global:         global:{endpoint}
Plan-based:     plan:{planType}:{endpoint}
```

---

## 5. API Versioning

### URL Path Versioning (Recommended)

```
/api/v1/users
/api/v2/users
```

**Pros:** Explicit, easy to route, cache-friendly
**Cons:** URL pollution, can't version by content type

### Header Versioning

```
GET /api/users
Accept: application/vnd.example.v1+json
```

**Pros:** Clean URLs, content negotiation
**Cons:** Harder to test, discover, and document

### Versioning Rules

```
1. Start with /v1/ immediately (even if only one version exists)
2. Maintain backward compatibility within a major version
3. Deprecate versions with clear sunset dates (min 6 months notice)
4. Include sunset header on deprecated endpoints: Sunset: Sat, 1 Jan 2027
5. Document changelog per version
6. Support at least one previous version during transition
```

---

## 6. Idempotency

### Idempotency Key Pattern

```
// Client generates unique key, sends with POST/PATCH
POST /api/v1/charges
Idempotency-Key: uuid_v4  ← header

// Server checks if key was already processed
// If yes → return previous response (safe replay)
// If no → process and cache response keyed by Idempotency-Key
```

### When to Require Idempotency Keys

```
Always for:   Payments, subscriptions, any money-moving operation
Always for:   Resource creation that shouldn't duplicate (POST)
Recommended:  Any mutation that could be retried by client
Never for:    Pure reads (GET is naturally idempotent)
```

### Idempotency Cache Rules

```
TTL:      24 hours (cover retry windows)
Include:  response status + body (so replays get same result)
Evict:    After TTL expires (don't store forever)
Scoped:   Per-user (different users should NOT get cached responses)
Conflict: If same key with different body → 409 Conflict
```

---

## 7. Webhooks

### Delivery Pattern

```
1. Event occurs on server
2. Server builds event payload
3. Server POSTs to registered webhook URL
4. Client responds with 200 OK
5. If timeout/non-200: retry with exponential backoff
6. After max retries: mark as failed, alert
```

### Webhook Payload

```json
{
  "id": "evt_abc123",
  "type": "user.created",
  "created": 1700000000,
  "data": {
    "id": "user_xyz",
    "email": "user@example.com"
  }
}
```

### Webhook Security

```
1. Sign payloads with HMAC-SHA256 secret
2. Include signature in header: X-Signature: sha256=...
3. Client verifies signature before processing
4. Validate that webhook URL is HTTPS (never plain HTTP)
5. Allow client to rotate secrets
6. Provide replay mechanism for missed events
7. Support filtering by event type
```

### Delivery Guarantees

```
At-least-once:        Webhooks may be delivered more than once (idempotent processing)
Ordering:             Not guaranteed — include sequence_id or event_time for ordering
Retry schedule:       Wait 1 min → 5 min → 15 min → 1 hour → 6 hours → 24 hours
Dead letter:          After max retries, store failed events for manual replay
```

---

## 8. Authentication & Authorization for APIs

### Auth Methods by Use Case

| Method | Use Case | Security Level |
|---|---|---|
| **Bearer Token (JWT)** | Machine-to-machine, user impersonation | High (short TTL + rotation) |
| **API Key** | Service accounts, integrations | Medium (long-lived, harder to rotate) |
| **Basic Auth** | Legacy, rarely recommended | Low (must use HTTPS) |
| **OAuth 2.0** | Third-party integrations | High (scoped permissions) |
| **Mutual TLS** | High-security B2B | Very high (certificate-based) |

### API Key Best Practices

```
1. Prefix keys to identify type: sk_live_xxx, sk_test_xxx
2. Hash keys before storing (never store plaintext)
3. Only show full key once at creation time
4. Provide UI for key rotation/revocation
5. Scope keys to specific permissions
6. Log key usage for audit
7. Allow expiry dates on keys
```

---

## 9. Request Validation

### Validation Layers

```
Layer 1: Structural validation (syntax, types, required fields)
  → 400 Bad Request

Layer 2: Semantic validation (business rules, uniqueness)
  → 422 Unprocessable Entity

Layer 3: Authorization (does the user have permission?)
  → 403 Forbidden

Layer 4: State validation (conflict with existing state)
  → 409 Conflict
```

### Input Sanitization Rules

```
Strip:      Null bytes, control characters (except \n)
Reject:     HTML/script tags in text fields (XSS prevention)
Normalize:  Unicode, email, phone numbers to canonical form
Validate:   Length, format, allowed values BEFORE processing
Limit:      Body size, array length, string length
```

---

## 10. API Observability

### Logging

```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "level": "info",
  "requestId": "req_abc123",
  "method": "POST",
  "path": "/api/v1/users",
  "status": 201,
  "durationMs": 42,
  "userId": "user_xyz",
  "ip": "203.0.113.42",
  "userAgent": "curl/8.0"
}
```

### Key Metrics

```
Latency:    p50, p95, p99 response time per endpoint
Error rate: 5xx / total requests per endpoint
Request:    Requests per second per endpoint
Saturation: DB connection pool, queue depth, thread pool
Auth:       Failed login attempts, token refresh rate
Integration: Upstream API latency, error rate
```

### Health Endpoint

```
GET /api/health

{
  "status": "ok",             // ok | degraded | down
  "version": "1.2.3",
  "uptime": 3600,
  "dependencies": {
    "database": { "status": "ok", "latencyMs": 5 },
    "cache": { "status": "ok", "latencyMs": 2 },
    "storage": { "status": "degraded", "latencyMs": 1200 }
  }
}
```

---

## 11. Caching Strategy

### Cache Layers

```
Client-side:    Browser cache (Cache-Control headers)
CDN:            Edge cache (GET responses, static assets)
Application:    In-memory cache (Redis, Memcached)
Database:       Query cache (materialized views, read replicas)
```

### Cache Headers

```
Cache-Control: public, max-age=3600, s-maxage=7200
Cache-Control: private, no-cache, no-store, must-revalidate
ETag: "abc123"                    → Conditional GET (304 Not Modified)
Last-Modified: Wed, 1 Jan 2026    → Conditional GET (304 Not Modified)
Expires: Wed, 1 Jan 2027          → Deprecated, use Cache-Control instead
```

### Cache Invalidation Rules

```
Time-based:  Set appropriate TTLs (trade-off freshness vs performance)
Event-based: Purge on write (POST/PUT/PATCH/DELETE to same resource)
Tag-based:   Purge by tag (useful for related resources)
Skip:        Never cache 5xx responses, auth errors, or user-specific data
```

---

## 12. Common API Anti-Patterns

| Anti-pattern | Why It's Bad | Fix |
|---|---|---|
| No versioning | Can't evolve API without breaking clients | Add `/v1/` prefix from day one |
| No pagination for list endpoints | Client crashes on large datasets | Always paginate list responses |
| Returning 500 for validation errors | Hides the real issue from client | 400/422 with field-level errors |
| No rate limiting | One noisy client can take down the service | Implement rate limiting early |
| Stack traces in error responses | Security vulnerability, information leak | Generic error messages in production |
| Boolean flags in request body | Unclear semantics, hard to deprecate | Use explicit enum or state machine |
| Omitting idempotency keys | Duplicate payments, double-created resources | Add Idempotency-Key header to mutations |
| Webhooks without signatures | Anyone can fake a webhook payload | HMAC-sign all webhook payloads |
| No request ID on errors | Impossible to debug client issues | Generate requestId for every request |
| Mixing camelCase and snake_case | Client confusion, inconsistent DX | Pick one convention, stick to it everywhere |

---

## 13. Implementation Checklist for New API

- [ ] Pick URL structure convention (/api/v1/)
- [ ] Set up standard error response format
- [ ] Implement pagination (cursor-based preferred)
- [ ] Add rate limiting with standard headers
- [ ] Implement idempotency on all mutations
- [ ] Set up API key management (creation, rotation, revocation)
- [ ] Add request logging with correlation IDs
- [ ] Create health endpoint
- [ ] Set up CORS configuration
- [ ] Add request validation layer
- [ ] Implement versioning strategy
- [ ] Set up webhook delivery system (if applicable)
- [ ] Add cache headers
- [ ] Document error codes
- [ ] Create integration tests for auth, errors, pagination