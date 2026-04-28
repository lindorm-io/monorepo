# @lindorm/conduit

Middleware-based HTTP client built on Axios with retries, circuit breaking, rate limiting, request deduplication, response caching, OAuth2 client credentials, DPoP, and Zod schema validation.

This package is **ESM-only**. All examples use `import`; `require` is not supported.

## Installation

```bash
npm install @lindorm/conduit
```

`@lindorm/logger` is an optional peer dependency — it only needs to be installed if you pass a logger to the `Conduit` constructor.

## Quick Start

```typescript
import { Conduit } from "@lindorm/conduit";

const client = new Conduit({ baseURL: "https://api.example.com" });

const { data } = await client.get<Array<User>>("/users");

const { data: created } = await client.post<User>("/users", {
  body: { name: "Jane", email: "jane@example.com" },
});

const { data: user } = await client.get<User>("/users/:id/posts", {
  params: { id: "123" },
  query: { limit: 10, offset: 0 },
});
// resolves to /users/123/posts?limit=10&offset=0
```

## Constructor Options

```typescript
import { Conduit } from "@lindorm/conduit";

const client = new Conduit({
  adapter: "http",
  alias: "MyAPI",
  baseURL: "https://api.example.com",
  config: {},
  environment: "production",
  headers: { "X-Client": "v1" },
  logger,
  middleware: [],
  retryCallback: (err, attempt, config) => attempt < config.maxAttempts,
  retryOptions: {
    maxAttempts: 5,
    strategy: "exponential",
    timeout: 250,
    timeoutMax: 10000,
  },
  timeout: 30000,
  withCredentials: false,
});
```

| Option            | Type                             | Default         | Description                                                                                  |
| ----------------- | -------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `adapter`         | `"http" \| "fetch"`              | `"http"`        | Axios adapter. `"http"` uses Node `http`/`https`; `"fetch"` uses native fetch / undici.      |
| `alias`           | `string`                         | `null`          | Human-readable name used in log entries.                                                     |
| `baseURL`         | `URL \| string`                  | `undefined`     | Base URL prepended to every request path.                                                    |
| `config`          | `RawAxiosRequestConfig` (subset) | `{}`            | Native Axios config pass-through (excluding fields Conduit owns: method, url, headers, etc). |
| `environment`     | `Environment`                    | `null`          | Sent as the `X-Environment` request header.                                                  |
| `headers`         | `Dict<string>`                   | `{}`            | Default headers merged into every request.                                                   |
| `logger`          | `ILogger`                        | `undefined`     | When set, request and response logging middleware are added automatically.                   |
| `middleware`      | `Array<ConduitMiddleware>`       | `[]`            | Instance-wide middleware pipeline.                                                           |
| `retryCallback`   | `RetryCallback`                  | network + 5xx\* | Predicate deciding whether a failed request is retried.                                      |
| `retryOptions`    | `RetryOptions`                   | see below       | Retry config from `@lindorm/retry`.                                                          |
| `timeout`         | `number`                         | `30000`         | Per-request timeout in milliseconds.                                                         |
| `withCredentials` | `boolean`                        | `undefined`     | Whether to send credentials with cross-origin requests.                                      |

\* The default predicate retries on network errors and HTTP `502`, `503`, `504`.

## Request Options

Every HTTP method (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`) accepts a path/URL and an optional options object:

```typescript
const { data, status, headers } = await client.get<ResponseType>("/path", {
  adapter: "fetch",
  body: { key: "value" },
  config: {},
  expectedResponse: "json",
  filename: "upload.zip",
  form: formData,
  headers: { "X-Custom": "value" },
  middleware: [myMiddleware],
  onDownloadProgress: ({ loaded, total }) => {},
  onRetry: (err, attempt, config) => {},
  onUploadProgress: ({ loaded, total }) => {},
  params: { id: "123" },
  query: { search: "foo" },
  retryCallback: (err, attempt, config) => false,
  retryOptions: { maxAttempts: 3 },
  signal: abortController.signal,
  stream: readableStream,
  timeout: 5000,
  withCredentials: true,
});
```

`expectedResponse` accepts `"arraybuffer" | "blob" | "document" | "formdata" | "json" | "stream" | "text"`.

The generic `request()` method takes a single combined options object:

```typescript
const result = await client.request<Data>({
  method: "POST",
  path: "/items",
  body: { name: "item" },
});

const result2 = await client.request<Data>({
  method: "GET",
  url: "https://other-api.com/items",
});
```

`request` throws if neither `path` nor `url` is provided.

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

## Default Headers

Every request automatically sets:

- `Date` — current timestamp (`toUTCString`)
- `X-Correlation-Id` — random UUID per request (override with `conduitCorrelationMiddleware`)
- `X-Request-Id` — random UUID per request
- `X-Environment` — only when `environment` is configured on the constructor

## Middleware

Conduit uses a Koa-style middleware pipeline. Each middleware receives `(ctx, next)` and may modify the request before `next()` and/or the response after `next()`.

The execution order is: response logger (if `logger` is set) → default headers → instance middleware → per-request middleware → request logger (if `logger` is set) → terminal Axios handler.

### Writing custom middleware

```typescript
import type { ConduitMiddleware } from "@lindorm/conduit";

const timingMiddleware: ConduitMiddleware = async (ctx, next) => {
  const start = Date.now();
  ctx.req.headers["X-Request-Start"] = String(start);

  await next();

  const elapsed = Date.now() - start;
  ctx.logger?.debug("Request finished", {
    method: ctx.req.config.method,
    url: ctx.req.url,
    elapsed,
  });
};
```

### Authentication

```typescript
import {
  conduitBasicAuthMiddleware,
  conduitBearerAuthMiddleware,
} from "@lindorm/conduit";

// Authorization: Basic <base64(user:pass)>
const basic = conduitBasicAuthMiddleware("username", "password");

// Authorization: Bearer <token>
const bearer = conduitBearerAuthMiddleware("my-access-token");

// Authorization: <type> <token>
const dpopBearer = conduitBearerAuthMiddleware("my-token", "DPoP");
```

### DPoP (RFC 9449)

`createConduitDpopAuthMiddleware` is a curried factory. The outer call binds a long-lived signer; the inner call binds a per-request access token. Each request signs a fresh DPoP proof JWT.

```typescript
import { createConduitDpopAuthMiddleware } from "@lindorm/conduit";

const dpopAuth = createConduitDpopAuthMiddleware(signer);

await client.get("/orders", {
  middleware: [dpopAuth(accessToken)],
});

await client.get("/orders", {
  middleware: [dpopAuth(accessToken, { nonce: serverIssuedNonce })],
});
```

A DPoP signer needs an `algorithm` (a `JwksAlgorithm`), the public JWK, and a `sign(data: Uint8Array) => Promise<Uint8Array>` function. The `webCryptoToDpopSigner` helper builds one from a Web Crypto `CryptoKeyPair`:

```typescript
import { webCryptoToDpopSigner } from "@lindorm/conduit";

const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  false,
  ["sign", "verify"],
);

const signer = await webCryptoToDpopSigner(keyPair);
```

Supported algorithms: `ES256` / `ES384` / `ES512` (ECDSA P-256/384/521), `RS256` / `RS384` / `RS512` (RSASSA-PKCS1-v1_5), and `PS256` / `PS384` / `PS512` (RSA-PSS).

### OAuth2 Client Credentials

`conduitClientCredentialsMiddlewareFactory` returns an async factory that performs OIDC discovery (unless `tokenUri` is supplied), fetches and caches access tokens, deduplicates concurrent token requests for the same `(audience, issuer)`, and emits a per-request middleware that attaches the token via Bearer auth (or DPoP, when `dpopSigner` is supplied).

```typescript
import { conduitClientCredentialsMiddlewareFactory } from "@lindorm/conduit";

const getAuthMiddleware = conduitClientCredentialsMiddlewareFactory({
  authLocation: "body",
  clientId: "my-client-id",
  clientSecret: "my-client-secret",
  clockTolerance: 10,
  contentType: "application/json",
  defaultExpiration: 3600,
  issuer: "https://auth.example.com",
  tokenUri: "https://auth.example.com/oauth/token",
});

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

Factory configuration:

| Option              | Type                                                        | Default                | Description                                                                                                       |
| ------------------- | ----------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `authLocation`      | `"body" \| "header"`                                        | `"body"`               | `"body"` puts `client_id`/`client_secret` in the body. `"header"` uses HTTP Basic.                                |
| `clientId`          | `string`                                                    | required               | OAuth2 client identifier.                                                                                         |
| `clientSecret`      | `string`                                                    | required               | OAuth2 client secret.                                                                                             |
| `clockTolerance`    | `number`                                                    | `10`                   | Seconds subtracted from the token TTL when caching, to refresh before expiry.                                     |
| `contentType`       | `"application/json" \| "application/x-www-form-urlencoded"` | `"application/json"`   | Token request body encoding.                                                                                      |
| `defaultExpiration` | `number`                                                    | `undefined`            | Fallback TTL in seconds when the token response provides neither `exp` nor `expires_in`.                          |
| `dpopSigner`        | `DpopSigner`                                                | `undefined`            | When set, the token request carries a DPoP proof and the issued token is bound via `Authorization: DPoP <token>`. |
| `grantType`         | `"client_credentials"`                                      | `"client_credentials"` | Grant type sent to the token endpoint.                                                                            |
| `issuer`            | `string`                                                    | required               | OIDC issuer URL. Used to discover the token endpoint when `tokenUri` is not given.                                |
| `tokenUri`          | `string`                                                    | `undefined`            | Skip OIDC discovery and POST directly to this URL.                                                                |

The factory takes an optional second argument `cache: Array<CacheItem>` — pass your own array to share a token cache between factories.

The returned function signature is `(options?: { audience?: string; scope?: Array<string> }, logger?: ILogger) => Promise<ConduitMiddleware>`.

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
    conduitChangeRequestBodyMiddleware("snake"),
    conduitChangeRequestQueryMiddleware("snake"),
    conduitChangeRequestHeadersMiddleware("header"),
    conduitChangeResponseDataMiddleware("camel"),
  ],
});
```

Modes are any `ChangeCase` value from `@lindorm/case`: `"camel" | "capital" | "constant" | "dot" | "header" | "kebab" | "lower" | "pascal" | "path" | "sentence" | "snake" | "none"`. Defaults: body → `snake`, query → `snake`, headers → `header`, response data → `camel`.

### Response Caching

In-memory cache for `GET` requests with `2xx` status. The cache key is method + URL + JSON-serialised query.

```typescript
import { createConduitCacheMiddleware } from "@lindorm/conduit";

const cacheMiddleware = createConduitCacheMiddleware({
  maxAge: 300_000,
  maxEntries: 1000,
});
```

| Option       | Default  | Description                                       |
| ------------ | -------- | ------------------------------------------------- |
| `maxAge`     | `300000` | TTL in milliseconds.                              |
| `maxEntries` | `1000`   | Cap on cached responses; oldest is evicted first. |

Responses with `Cache-Control: no-cache` or `no-store` are not cached. Cached entries are returned as shallow copies.

### Request Deduplication

Coalesces concurrent identical `GET` and `HEAD` requests into a single in-flight request:

```typescript
import { createConduitDeduplicationMiddleware } from "@lindorm/conduit";

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [createConduitDeduplicationMiddleware()],
});

const [a, b] = await Promise.all([
  client.get("/expensive-data"),
  client.get("/expensive-data"),
]);
// only one HTTP request fires; both promises resolve with the same response
```

### Rate Limiting

Token-bucket rate limiter. Throws a `ConduitError` with `status: 429` when the bucket is empty.

```typescript
import { createConduitRateLimitMiddleware } from "@lindorm/conduit";

const rateLimit = createConduitRateLimitMiddleware({
  maxRequests: 100,
  windowMs: 60_000,
  perOrigin: true,
});
```

| Option        | Default | Description                                                               |
| ------------- | ------- | ------------------------------------------------------------------------- |
| `maxRequests` | `100`   | Bucket capacity (and refill target across one window).                    |
| `windowMs`    | `60000` | Refill window in milliseconds. Tokens refill continuously, not in bursts. |
| `perOrigin`   | `true`  | Use a separate bucket per origin. When `false`, a single global bucket.   |

### Circuit Breaker

Per-origin circuit breaker built on `@lindorm/breaker`. The breaker name is `conduit:<origin>`.

```typescript
import { createConduitCircuitBreakerMiddleware } from "@lindorm/conduit";

const breaker = createConduitCircuitBreakerMiddleware(
  {
    threshold: 5,
    window: 60_000,
    halfOpenDelay: 30_000,
    halfOpenBackoff: 2,
    halfOpenMaxDelay: 600_000,
  },
  logger,
);
```

| Option             | Type                                                          | Description                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `threshold`        | `number`                                                      | Number of transient failures within `window` before the breaker opens.                                                                                                        |
| `window`           | `number`                                                      | Sliding failure window in milliseconds.                                                                                                                                       |
| `halfOpenDelay`    | `number`                                                      | Initial delay before the breaker probes (transitions to half-open).                                                                                                           |
| `halfOpenBackoff`  | `number`                                                      | Multiplier applied to the half-open delay on repeated probe failures.                                                                                                         |
| `halfOpenMaxDelay` | `number`                                                      | Upper bound on the half-open delay.                                                                                                                                           |
| `classifier`       | `(error: Error) => "transient" \| "permanent" \| "ignorable"` | Custom error classifier. The default treats `ConduitError`s as: `permanent` for status `501/505/506/510/511`, `transient` for any other 5xx, `ignorable` for everything else. |

Defaults are inherited from `@lindorm/breaker`. The signature also accepts a third argument `cache: Map<string, ICircuitBreaker>` for sharing breaker state between middleware instances. When a `logger` is supplied, the middleware logs `open` / `half-open` / `closed` state changes. When the breaker is open, requests reject with a `ConduitError` whose message is `"Circuit breaker is open"`.

### Schema Validation

Validate response data against a Zod schema:

```typescript
import { conduitSchemaMiddleware } from "@lindorm/conduit";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
});

const client = new Conduit({
  baseURL: "https://api.example.com",
  middleware: [conduitSchemaMiddleware(userSchema)],
});

const { data } = await client.get("/user/123");
// throws ConduitError if data does not match userSchema
```

Accepts `ZodObject` (object schemas are parsed in loose mode, preserving extra keys) or `ZodArray`. Validation failures are wrapped in `ConduitError`.

### Headers

```typescript
import { conduitHeaderMiddleware, conduitHeadersMiddleware } from "@lindorm/conduit";

const versionHeader = conduitHeaderMiddleware("X-API-Version", "v2");

const headers = conduitHeadersMiddleware({
  "X-API-Version": "v2",
  "X-Client-ID": "my-app",
});
```

### Correlation and Session Tracking

```typescript
import { conduitCorrelationMiddleware, conduitSessionMiddleware } from "@lindorm/conduit";

const correlation = conduitCorrelationMiddleware("correlation-id-123");
const session = conduitSessionMiddleware("session-id-456");
```

`conduitCorrelationMiddleware` overrides `ctx.req.metadata.correlationId` (which then becomes the `X-Correlation-Id` request header). `conduitSessionMiddleware` sets `ctx.req.metadata.sessionId`, which the request logger picks up.

## Retry

By default Conduit retries up to 5 times with exponential backoff (250 ms base, 10 s cap) on network errors and HTTP `502`, `503`, `504`. Override per instance or per request:

```typescript
const client = new Conduit({
  baseURL: "https://api.example.com",
  retryOptions: {
    maxAttempts: 3,
    strategy: "exponential",
    timeout: 500,
    timeoutMax: 15_000,
  },
  retryCallback: (error, attempt, config) => {
    if (error.isClientError) return false;
    return attempt <= config.maxAttempts;
  },
});

await client.get("/flaky-endpoint", {
  onRetry: (error, attempt, config) => {
    console.error(`Retry ${attempt}/${config.maxAttempts}: ${error.message}`);
  },
});
```

`strategy` is `"exponential" | "linear"` (re-exported from `@lindorm/retry` as `RetryStrategy`). Aborted requests stop retrying.

## Abort / Cancellation

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const { data } = await client.get("/slow-endpoint", {
  signal: controller.signal,
});
```

## File Uploads

```typescript
const form = new FormData();
form.append("file", blob, "document.pdf");
form.append("description", "Important document");

await client.post("/upload", { form });

import { createReadStream } from "node:fs";

await client.post("/upload", {
  stream: createReadStream("large-file.zip"),
  filename: "large-file.zip",
});
```

Stream uploads require the `"http"` adapter.

## Streaming and Progress

```typescript
const { data: stream } = await client.get("/large-file", {
  expectedResponse: "stream",
});

await client.get("/large-file", {
  onDownloadProgress: ({ loaded, total }) => {
    console.log(`Downloaded ${loaded}/${total ?? "unknown"} bytes`);
  },
});

await client.post("/upload", {
  form: formData,
  onUploadProgress: ({ loaded, total }) => {
    console.log(`Uploaded ${loaded}/${total ?? "unknown"} bytes`);
  },
});
```

## Error Handling

```typescript
import { ConduitError } from "@lindorm/conduit";

try {
  await client.get("/not-found");
} catch (error) {
  if (error instanceof ConduitError) {
    error.status; // HTTP status code, or <= 0 for network errors
    error.message; // human-readable message
    error.isClientError; // 400 <= status < 500
    error.isServerError; // 500 <= status < 600
    error.isNetworkError; // status <= 0 with no response (DNS, ECONNREFUSED, etc.)
    error.config; // sanitised Axios config snapshot
    error.request; // request details
    error.response; // response details: headers, data, status, statusText
  }
}
```

`ConduitError.fromAxiosError` and `ConduitError.fromFetchError` are also exposed for adapter-level integrations. When a response body looks like a Pylon (`@lindorm` server framework) error envelope, `id`, `code`, `data`, `message`, `support`, and `title` are lifted into the corresponding `LindormError` fields.

## Public Exports

### Classes

- `Conduit` — HTTP client.

### Errors

- `ConduitError` — extends `LindormError` from `@lindorm/errors`.

### Interfaces

- `IConduit` — public surface implemented by `Conduit`.

### Middleware

- `conduitBasicAuthMiddleware(username, password)`
- `conduitBearerAuthMiddleware(accessToken, tokenType?)`
- `conduitChangeRequestBodyMiddleware(mode?)`
- `conduitChangeRequestHeadersMiddleware(mode?)`
- `conduitChangeRequestQueryMiddleware(mode?)`
- `conduitChangeResponseDataMiddleware(mode?)`
- `conduitClientCredentialsMiddlewareFactory(config, cache?)`
- `conduitCorrelationMiddleware(correlationId)`
- `conduitHeaderMiddleware(name, value)`
- `conduitHeadersMiddleware(headers)`
- `conduitSchemaMiddleware(schema)`
- `conduitSessionMiddleware(sessionId)`
- `createConduitCacheMiddleware(config?)`
- `createConduitCircuitBreakerMiddleware(config?, logger?, cache?)`
- `createConduitDeduplicationMiddleware()`
- `createConduitDpopAuthMiddleware(signer)`
- `createConduitRateLimitMiddleware(config?)`

### Utilities

- `webCryptoToDpopSigner(keyPair)` — turn a Web Crypto `CryptoKeyPair` into a `DpopSigner`.

### Types

`AppContext`, `ConduitAdapter`, `ConduitCircuitBreakerCache`, `ConduitCircuitBreakerConfig`, `ConduitClientCredentialsCache`, `ConduitClientCredentialsMiddlewareFactory`, `ConduitContext`, `ConduitDpopAuthOptions`, `ConduitMiddleware`, `ConduitOptions`, `ConduitResponse`, `ConfigContext`, `ConfigOptions`, `ExpectedResponse`, `MethodOptions`, `OnRetryCallback`, `RequestContext`, `RequestMetadata`, `RequestOptions`, `RetryCallback`, `RetryStrategy` (re-exported from `@lindorm/retry`).

## Full Example

```typescript
import {
  Conduit,
  conduitBearerAuthMiddleware,
  conduitChangeRequestBodyMiddleware,
  conduitChangeResponseDataMiddleware,
  createConduitCacheMiddleware,
  createConduitCircuitBreakerMiddleware,
  createConduitDeduplicationMiddleware,
  createConduitRateLimitMiddleware,
} from "@lindorm/conduit";

const client = new Conduit({
  alias: "ExampleAPI",
  baseURL: "https://api.example.com",
  headers: { "X-Client-Version": "1.0.0" },
  logger,
  middleware: [
    createConduitCircuitBreakerMiddleware({}, logger),
    createConduitRateLimitMiddleware({ maxRequests: 50 }),
    createConduitDeduplicationMiddleware(),
    createConduitCacheMiddleware({ maxAge: 60_000 }),
    conduitBearerAuthMiddleware(process.env.API_TOKEN!),
    conduitChangeRequestBodyMiddleware("snake"),
    conduitChangeResponseDataMiddleware("camel"),
  ],
  retryOptions: { maxAttempts: 3, strategy: "exponential" },
  timeout: 15_000,
});

const { data } = await client.get<Array<User>>("/v1/users", {
  query: { active: true },
});
```

## License

AGPL-3.0-or-later
