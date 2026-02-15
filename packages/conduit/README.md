# @lindorm/conduit

Middleware-based HTTP client supporting Axios and Fetch engines with automatic retries, circuit breaking, rate limiting, request deduplication, response caching, OAuth2 client credentials, and Zod schema validation.

## Installation

```bash
npm install @lindorm/conduit axios form-data
```

Axios and form-data are peer dependencies. If you only use the Fetch engine, you can skip them.

## Quick Start

```typescript
import { Conduit } from "@lindorm/conduit";

const client = new Conduit({ baseURL: "https://api.example.com" });

// GET
const { data } = await client.get<User[]>("/users");

// POST with body
const { data: created } = await client.post<User>("/users", {
  body: { name: "Jane", email: "jane@example.com" },
});

// Path parameters and query
const { data: user } = await client.get<User>("/users/:id/posts", {
  params: { id: "123" },
  query: { limit: 10, offset: 0 },
});
// Resolves to: /users/123/posts?limit=10&offset=0
```

## Constructor Options

```typescript
const client = new Conduit({
  alias: "MyAPI",                 // Human-readable name for logging
  baseURL: "https://api.example.com", // Base URL for all requests
  config: {},                     // Native Axios/Fetch config pass-through
  environment: "production",      // Added as X-Environment header
  headers: { "X-Client": "v1" }, // Default headers for all requests
  logger: myLogger,               // ILogger instance (enables request/response logging)
  middleware: [],                  // Middleware pipeline
  retryCallback: myCallback,      // Custom retry predicate
  retryOptions: {                 // Retry configuration
    maxAttempts: 5,
    strategy: "exponential",
    timeout: 250,
    timeoutMax: 10000,
  },
  timeout: 30000,                 // Request timeout in ms (default: 30000)
  using: "axios",                 // "axios" (default) or "fetch"
  withCredentials: false,         // Include credentials
});
```

## Request Options

Every HTTP method (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`) accepts a path and an optional options object:

```typescript
const { data, status, headers } = await client.get<ResponseType>("/path", {
  body: { key: "value" },             // Request body (POST/PUT/PATCH)
  config: {},                          // Native engine config overrides
  expectedResponse: "json",            // "json" | "text" | "blob" | "arraybuffer" | "stream" | "formdata" | "document"
  filename: "upload.zip",              // Filename for stream uploads
  form: formData,                      // FormData for multipart uploads
  headers: { "X-Custom": "value" },   // Per-request headers
  middleware: [myMiddleware],          // Per-request middleware
  onDownloadProgress: (e) => {},       // Download progress callback
  onRetry: (err, attempt, config) => {},// Called before each retry attempt
  onUploadProgress: (e) => {},         // Upload progress callback (Axios only)
  params: { id: "123" },              // URL path parameters (:id substitution)
  query: { search: "foo" },           // Query string parameters
  retryCallback: myCallback,          // Per-request retry predicate
  retryOptions: { maxAttempts: 3 },   // Per-request retry config
  signal: abortController.signal,      // AbortSignal for cancellation
  stream: readableStream,             // Readable stream for uploads (Axios only)
  timeout: 5000,                       // Per-request timeout
  using: "fetch",                      // Per-request engine override
  withCredentials: true,               // Per-request credentials
});
```

You can also use the generic `request()` method:

```typescript
const result = await client.request<Data>({
  method: "POST",
  path: "/items",
  // or: url: "https://other-api.com/items"
}, { body: { name: "item" } });
```

## Response Shape

All methods return a `ConduitResponse<D>`:

```typescript
type ConduitResponse<D> = {
  data: D;
  status: number;
  statusText: string;
  headers: Dict<Header>;
};
```

## Middleware

Conduit uses a Koa-style middleware pipeline. Each middleware receives `(ctx, next)` and can modify the request before `next()` and/or the response after `next()`.

Instance middleware runs before per-request middleware. When a logger is provided, request/response logging middleware wraps the entire pipeline automatically.

### Writing Custom Middleware

```typescript
import { ConduitMiddleware } from "@lindorm/conduit";

const timingMiddleware: ConduitMiddleware = async (ctx, next) => {
  // Before request
  const start = Date.now();
  ctx.req.headers["X-Request-Start"] = String(start);

  await next();

  // After response
  const elapsed = Date.now() - start;
  console.log(`${ctx.req.config.method} ${ctx.req.url} took ${elapsed}ms`);
};
```

### Authentication

```typescript
import {
  conduitBasicAuthMiddleware,
  conduitBearerAuthMiddleware,
} from "@lindorm/conduit";

// Basic auth - sets Authorization: Basic <base64(user:pass)>
conduitBasicAuthMiddleware("username", "password");

// Bearer token - sets Authorization: Bearer <token>
conduitBearerAuthMiddleware("my-access-token");

// Custom token type
conduitBearerAuthMiddleware("my-token", "DPoP");
```

### OAuth2 Client Credentials

Factory pattern that handles OIDC discovery, token fetching, caching, and automatic refresh:

```typescript
import { conduitClientCredentialsMiddlewareFactory } from "@lindorm/conduit";

const getAuthMiddleware = conduitClientCredentialsMiddlewareFactory({
  clientId: "my-client-id",
  clientSecret: "my-client-secret",
  issuer: "https://auth.example.com",
  // Optional:
  authLocation: "body",                    // "body" (default) or "header" (Basic auth)
  contentType: "application/json",          // or "application/x-www-form-urlencoded"
  clockTolerance: 10,                       // Seconds before expiry to refresh (default: 10)
  defaultExpiration: 3600,                  // Fallback TTL in seconds
  tokenUri: "https://auth.example.com/token", // Skip OIDC discovery
  using: "fetch",                           // Engine for token requests
});

// Per-request: fetches/caches tokens automatically
const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [
    await getAuthMiddleware(
      { audience: "https://api.example.com", scope: ["read", "write"] },
      logger,
    ),
  ],
});
```

Tokens are cached and reused across calls. Concurrent token requests for the same audience/issuer are deduplicated.

### Case Conversion

```typescript
import {
  conduitChangeRequestBodyMiddleware,
  conduitChangeRequestHeadersMiddleware,
  conduitChangeRequestQueryMiddleware,
  conduitChangeResponseDataMiddleware,
} from "@lindorm/conduit";

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [
    conduitChangeRequestBodyMiddleware("snake"),    // { userName } -> { user_name }
    conduitChangeRequestQueryMiddleware("snake"),    // ?userName -> ?user_name
    conduitChangeRequestHeadersMiddleware("header"), // xCustom -> X-Custom
    conduitChangeResponseDataMiddleware("camel"),    // { user_name } -> { userName }
  ],
});
```

Supported modes: `"camel"`, `"snake"`, `"pascal"`, `"header"`.

### Response Caching

In-memory cache for GET requests:

```typescript
import { createConduitCacheMiddleware } from "@lindorm/conduit";

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [
    createConduitCacheMiddleware({
      maxAge: 300000,    // TTL in ms (default: 300000 = 5 minutes)
      maxEntries: 1000,  // Max cached responses (default: 1000, FIFO eviction)
    }),
  ],
});
```

- Only caches GET requests with 2xx responses
- Respects `Cache-Control: no-cache` and `no-store` response headers
- Returns shallow copies to prevent cache mutation

### Request Deduplication

Deduplicates concurrent identical GET/HEAD requests:

```typescript
import { createConduitDeduplicationMiddleware } from "@lindorm/conduit";

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [createConduitDeduplicationMiddleware()],
});

// These fire only ONE HTTP request; both resolve with the same response
const [a, b] = await Promise.all([
  client.get("/expensive-data"),
  client.get("/expensive-data"),
]);
```

### Rate Limiting

Client-side token bucket rate limiter:

```typescript
import { createConduitRateLimitMiddleware } from "@lindorm/conduit";

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [
    createConduitRateLimitMiddleware({
      maxRequests: 100,   // Tokens per window (default: 100)
      windowMs: 60000,    // Window in ms (default: 60000)
      perOrigin: true,    // Separate buckets per origin (default: true)
    }),
  ],
});
```

Throws a `ConduitError` with status 429 when the limit is exceeded. Tokens refill continuously.

### Circuit Breaker

Per-origin circuit breaker that prevents cascading failures:

```typescript
import { createConduitCircuitBreakerMiddleware } from "@lindorm/conduit";

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [
    createConduitCircuitBreakerMiddleware({
      expiration: 120,            // Seconds before re-probing (default: 120)
      serverErrorThreshold: 5,    // 5xx errors before opening (default: 5)
      clientErrorThreshold: 1000, // 4xx errors before opening (default: 1000)
      verifier: customVerifier,   // Custom state transition logic (optional)
    }),
  ],
});
```

States: **closed** (normal) -> **open** (blocking requests) -> **half-open** (probing with one request) -> **closed** (recovered).

Unrecoverable status codes (501, 505, 506, 510, 511) immediately open the circuit.

### Schema Validation

Validate responses with Zod schemas:

```typescript
import { conduitSchemaMiddleware } from "@lindorm/conduit";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [conduitSchemaMiddleware(userSchema)],
});

// Throws ConduitError if response doesn't match schema
const { data } = await client.get("/user/123");
// data is validated against userSchema
```

Works with both `ZodObject` (uses `.passthrough()` to preserve extra keys) and `ZodArray`.

### Headers

```typescript
import {
  conduitHeaderMiddleware,
  conduitHeadersMiddleware,
} from "@lindorm/conduit";

// Single header
conduitHeaderMiddleware("X-API-Version", "v2");

// Multiple headers
conduitHeadersMiddleware({ "X-API-Version": "v2", "X-Client-ID": "my-app" });
```

### Correlation and Session Tracking

```typescript
import {
  conduitCorrelationMiddleware,
  conduitSessionMiddleware,
} from "@lindorm/conduit";

// Sets ctx.req.metadata.correlationId (also sent as X-Correlation-Id header)
conduitCorrelationMiddleware("correlation-id-123");

// Sets ctx.req.metadata.sessionId
conduitSessionMiddleware("session-id-456");
```

## Retry

By default, requests retry up to 5 times with exponential backoff (250ms base, 10s max) on:
- Network errors (connection failures, DNS errors)
- Status 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)

```typescript
import { RetryStrategy } from "@lindorm/conduit";

const client = new Conduit({
  baseURL: "https://api.example.com",
  retryOptions: {
    maxAttempts: 3,
    strategy: "exponential",  // or "linear"
    timeout: 500,
    timeoutMax: 15000,
  },
  // Custom retry predicate
  retryCallback: (error, attempt, config) => {
    if (error.isClientError) return false;
    return attempt < config.maxAttempts;
  },
});

// Per-request retry notification
await client.get("/flaky-endpoint", {
  onRetry: (error, attempt, config) => {
    console.log(`Retry ${attempt}/${config.maxAttempts}: ${error.message}`);
  },
});
```

## Abort / Cancellation

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const { data } = await client.get("/slow-endpoint", {
  signal: controller.signal,
});
```

When using the Fetch engine, the abort signal is combined with the timeout signal via `AbortSignal.any()`. Aborted requests stop retrying immediately.

## File Uploads

```typescript
// FormData (both engines)
const form = new FormData();
form.append("file", blob, "document.pdf");
form.append("description", "Important document");

await client.post("/upload", { form });

// Stream upload (Axios only)
import { createReadStream } from "fs";

await client.post("/upload", {
  stream: createReadStream("large-file.zip"),
  filename: "large-file.zip",
});
```

## Streaming and Progress

```typescript
// Download streaming (Fetch only)
const { data: stream } = await client.get("/large-file", {
  expectedResponse: "stream",
  using: "fetch",
});
// data is a ReadableStream

// Download progress (Fetch)
await client.get("/large-file", {
  using: "fetch",
  onDownloadProgress: ({ loaded, total }) => {
    console.log(`Downloaded ${loaded}/${total ?? "unknown"} bytes`);
  },
});

// Upload progress (Axios only)
await client.post("/upload", {
  form: formData,
  onUploadProgress: ({ loaded, total }) => {
    console.log(`Uploaded ${loaded}/${total ?? "unknown"} bytes`);
  },
});
```

## Engine Differences

| Feature | Axios | Fetch |
|---------|-------|-------|
| Stream upload | Yes | No |
| Download streaming | No | Yes (`expectedResponse: "stream"`) |
| Upload progress | Yes | No |
| Download progress | Yes (native) | Yes (manual ReadableStream reader) |
| Timeout mechanism | Axios native | `AbortSignal.timeout()` |
| Default | Yes | Opt-in via `using: "fetch"` |

Both engines support all HTTP methods, path parameters, query parameters, FormData, abort signals, and the full middleware pipeline.

## Error Handling

```typescript
import { ConduitError } from "@lindorm/conduit";

try {
  await client.get("/not-found");
} catch (error) {
  if (error instanceof ConduitError) {
    error.status;         // HTTP status code
    error.message;        // Error message
    error.isClientError;  // true for 4xx
    error.isServerError;  // true for 5xx
    error.isNetworkError; // true for connection failures (status <= 0, no response)
    error.config;         // Request configuration at time of error
    error.request;        // Request details
    error.response;       // Response details (headers, data, status)
  }
}
```

`ConduitError` automatically detects Pylon (Lindorm server framework) error responses and extracts structured error fields (`id`, `code`, `data`, `message`, `support`, `title`).

## Automatic Headers

When a logger is provided, every request automatically includes:
- `Date` -- current timestamp
- `X-Correlation-Id` -- unique correlation ID (UUID)
- `X-Request-Id` -- unique request ID (UUID)
- `X-Environment` -- environment string (if configured)

## Full Example

```typescript
import { Conduit, createConduitCacheMiddleware, createConduitCircuitBreakerMiddleware, createConduitDeduplicationMiddleware, createConduitRateLimitMiddleware, conduitChangeRequestBodyMiddleware, conduitChangeResponseDataMiddleware, conduitBearerAuthMiddleware } from "@lindorm/conduit";

const client = new Conduit({
  alias: "ExampleAPI",
  baseURL: "https://api.example.com",
  logger,
  timeout: 15000,
  headers: { "X-Client-Version": "1.0.0" },
  middleware: [
    createConduitCircuitBreakerMiddleware(),
    createConduitRateLimitMiddleware({ maxRequests: 50 }),
    createConduitDeduplicationMiddleware(),
    createConduitCacheMiddleware({ maxAge: 60000 }),
    conduitBearerAuthMiddleware(process.env.API_TOKEN!),
    conduitChangeRequestBodyMiddleware("snake"),
    conduitChangeResponseDataMiddleware("camel"),
  ],
  retryOptions: { maxAttempts: 3, strategy: "exponential" },
});

const { data } = await client.get<User[]>("/v1/users", {
  query: { active: true },
});
```

## License

AGPL-3.0-or-later
