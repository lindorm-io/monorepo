# @lindorm/pylon

HTTP and WebSocket application framework for Node.js, built on Koa and Socket.IO and wired into the Lindorm ecosystem.

This package is **ESM-only**. All examples use `import`; `require` is not supported.

## Installation

```bash
npm install @lindorm/pylon
```

### Peer dependencies

`@lindorm/amphora` and `@lindorm/logger` are required — both are constructor arguments to `Pylon`. The remaining peers are optional and only needed when their feature is used:

| Peer dependency    | Required for                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `@lindorm/amphora` | required — passed as `amphora`                                       |
| `@lindorm/logger`  | required — passed as `logger`                                        |
| `@lindorm/proteus` | sessions, rate limiting, presence, audit, webhooks, kryptos rotation |
| `@lindorm/iris`    | queue, audit publishing, webhook dispatch                            |
| `@lindorm/hermes`  | exposing a hermes session on `ctx.hermes`                            |

## Quick start

```typescript
import { Amphora } from "@lindorm/amphora";
import { Logger } from "@lindorm/logger";
import { Pylon, PylonRouter, useHandler } from "@lindorm/pylon";

const logger = new Logger({ readable: true });
const amphora = new Amphora({ internal: { issuer: "https://api.example.com" }, logger });

const router = new PylonRouter();

router.get(
  "/hello/:name",
  useHandler(async (ctx) => ({ body: { greeting: `Hello, ${ctx.params.name}!` } })),
);

const app = new Pylon({
  amphora,
  logger,
  port: 3000,
  routes: [{ path: "/", router }],
});

await app.start();
```

For scaffolding a new project, see `@lindorm/create-pylon` (`npm create @lindorm/pylon@latest my-app`).

## Features

- HTTP server built on Koa with a typed Pylon context, configurable CORS, body parsing, and error handling
- File-based and programmatic HTTP routing, with directory-level middleware inheritance
- WebSocket gateway built on Socket.IO with file-based and programmatic listeners
- Unified per-request context shared across HTTP and socket transports (logger, aegis, amphora, conduits, sessions)
- OpenID Connect Relying Party with auto-mounted login/logout/refresh/userinfo/introspect routes
- Cookie session store (encrypted by default) backed by a `Session` Proteus entity
- Bearer / DPoP / session token verification, plus role / permission / scope / claim matchers
- Rate limiting with fixed-window, sliding-window, and token-bucket strategies
- Multi-tenancy hooks (`useTenant`, `useScope`) that drive Proteus filter params
- Audit logging — request-level via Iris, optional entity-change tracking via Proteus listeners
- Webhook subscriptions with `none` / `auth_headers` / `basic` / `client_credentials` auth and automatic suspension on repeated failures
- Built-in workers for Kryptos key rotation, Amphora key sync, and expiry cleanup, plus a `pylon` CLI to generate routes, listeners, middleware, handlers, and workers
- Auto-mounted endpoints for `/health` (liveness), `/ready` (readiness), `/.well-known/jwks.json`, `/.well-known/oauth-protected-resource`, `/.well-known/right-to-be-forgotten`, `/.well-known/change-password`, and (opt-in) `/.well-known/security.txt`

## Core concepts

### Pylon

The main server class. `Pylon` owns the HTTP server, the optional Socket.IO gateway, the middleware pipeline, the worker scheduler, and the start / stop lifecycle.

```typescript
const app = new Pylon({
  amphora,
  logger,
  name: "my-service",
  version: "1.2.3",
  environment: "production",
  domain: "api.example.com",
  port: 3000,
  proxy: true,

  routes: [{ path: "/api", router: apiRouter }],
  cors: { allowOrigins: ["https://example.com"] },

  socket: {
    enabled: true,
    listeners: [chatListener],
  },

  db: proteusSource,
  kv: keyValueSource,
  cache: cacheSource, // optional — defaults to kv
  bus: irisSource,

  setup: async () => {
    /* runs before the server listens */
  },
  teardown: async () => {
    /* runs on shutdown */
  },

  workers: [myWorker],
});

await app.start();
// later…
await app.stop();
```

#### Source roles

Pylon takes **four** sources, and where each built-in entity lives is fixed — there are no per-feature source overrides.

| Role    | Type             | Per-request | Backs                                                                |
| ------- | ---------------- | ----------- | -------------------------------------------------------------------- |
| `db`    | `IProteusSource` | `ctx.db`    | `kryptos`, `webhook`, `audit` — durable and relational               |
| `kv`    | `IProteusSource` | `ctx.kv`    | `session`, `rooms` presence — authoritative, **must not be evicted** |
| `cache` | `IProteusSource` | `ctx.cache` | `responseCache`, `rateLimit`, the auth caches — **evictable**        |
| `bus`   | `IIrisSource`    | `ctx.bus`   | `queue`, `webhook` dispatch, `audit` publication                     |

**`cache` defaults to `kv` when unset**, so a single-instance deployment configures one ephemeral store and nothing changes for it — `ctx.cache` still works, it just points at the same instance as `ctx.kv`.

Reach for `ctx.cache` for anything throwaway. Writing evictable churn through `ctx.kv` puts it in the `noeviction` instance, which is the exact failure this split exists to prevent.

The split criterion is one question — **is eviction under memory pressure acceptable for this data?** — which is exactly what a Redis `maxmemory-policy` answers. Two populations with opposite needs used to share one instance: evict a `Session` to make room for a rate-limit bucket and a traffic spike logs users out.

- **`kv` → `noeviction`.** Losing a `Session` or a `Presence` record loses state a user can see.
- **`cache` → `allkeys-lru`.** Losing a cached response, a cached introspection answer or a rate-limit counter costs work, never state.

⚠ **Use `allkeys-lru` for `cache`, not `allkeys-random`.** Random eviction is as likely to drop the counter of an _actively attacking_ client as an idle one, which weakens the rate limit precisely when it matters; LRU keeps hot buckets — the ones under attack — resident.

| Entity                                                                                                             | Source                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `Kryptos`, `WebhookSubscription`, `RequestAuditLog`, `DataAuditLog`                                                | `db`                                                                                                                 |
| `Session`, `Presence`                                                                                              | `kv`                                                                                                                 |
| `CachedResponse`, `CachedIntrospection`, `CachedUserinfo`, `RateLimitFixed`, `RateLimitSliding`, `RateLimitBucket` | `cache`                                                                                                              |
| `Job`, `WebhookRequest`, `WebhookDispatch`, `RequestAudit`, `DataAuditChange`                                      | `bus`                                                                                                                |
| `ConduitCachedResponse`                                                                                            | consumer-placed — `createProteusCacheDriver(source)` takes the source you hand it; Pylon never registers this entity |

| Method / property | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| `start()`         | Runs `setup`, listens, starts workers, registers SIGINT/SIGTERM handlers |
| `setup()`         | Loads middleware, routers, listeners, and connects integrations          |
| `stop()`          | Closes the server, runs `teardown`, stops workers                        |
| `teardown()`      | Runs the user-provided teardown hook and disconnects integrations        |
| `work()`          | Runs `setup` and starts workers without binding the HTTP server          |
| `callback`        | Returns the raw Node.js `http` request callback (useful for testing)     |

### PylonRouter

HTTP router wrapping `koa-router`. All method calls return the router instance for chaining and accept any number of middleware functions.

```typescript
import { PylonRouter } from "@lindorm/pylon";

const router = new PylonRouter();

router
  .get("/users", listUsers)
  .post("/users", createUser)
  .put("/users/:id", updateUser)
  .patch("/users/:id", patchUser)
  .delete("/users/:id", deleteUser)
  .head("/users/:id", headUser)
  .options("/users", optionsUsers)
  .all("/health", healthCheck);

router.use(authMiddleware);
```

Supported methods: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `link`, `unlink`, `all`. The `routes()` and `allowedMethods()` getters expose the underlying Koa middleware for manual composition.

### PylonListener

Socket.IO listener builder with namespace, prefix, and middleware support.

```typescript
import { PylonListener } from "@lindorm/pylon";

const chat = new PylonListener({ namespace: "/chat", prefix: "msg:" });

chat.use(socketAuth);

chat.on("send", async (ctx) => {
  ctx.socket?.broadcast("general", "msg:receive", ctx.data);
});

chat.once("init", async (ctx) => {
  await ctx.rooms?.join("general");
});

const admin = new PylonListener({ namespace: "/chat/admin" });
admin.parent(chat);
```

Event registration methods: `on`, `once`, `onAny`, `onAnyOutgoing`, `prependAny`, `prependAnyOutgoing`. `parent()` prepends a parent listener's middleware chain to the child.

### Context

Every handler receives a Pylon context. The common surface is shared between HTTP and socket handlers; transport-specific properties are added on top.

Common (HTTP and socket):

```typescript
ctx.aegis;       // IAegis — JWT/JWS/CWT/CWS verification
ctx.amphora;     // IAmphora — key management
ctx.auth;        // PylonAuthClaimsClient — introspect() / userinfo()
ctx.conduits;    // map of named HTTP clients
ctx.entities;    // entity registry
ctx.logger;      // per-request scoped ILogger

ctx.db?;         // IProteusSession — durable source, when configured
ctx.kv?;         // IProteusSession — authoritative ephemeral source, when configured
ctx.cache?;      // IProteusSession — evictable ephemeral source (falls back to kv)
ctx.bus?;        // IIrisSession when configured
ctx.hermes?;     // IHermesSession when configured

ctx.publishers?;    // populated by createPublisherMiddleware
ctx.workerQueues?;  // populated by createWorkerQueueMiddleware

ctx.queue(event, payload, priority?, optional?);  // enqueue a Job (when queue.enabled)
ctx.webhook(event, data?, optional?);             // dispatch a webhook (when webhook.enabled)

ctx.state.access;         // PylonResolvedAccess | null — the resolved credential
ctx.state.app;            // { config, domain, environment, name, version }
ctx.state.app.config;     // the deployment's resolved policy — see below
ctx.state.actor;          // resolved actor string
ctx.state.authorization;  // { type: "basic" | "bearer" | "dpop" | "none", value }
ctx.state.metadata;       // { id, correlationId, date, environment, ... }
ctx.state.tenant?;        // tenant id when useTenant() ran
ctx.state.tokens;         // map of parsed tokens (accessToken, idToken, ...)
```

HTTP-only additions:

```typescript
ctx.auth;       // full PylonAuthClient (login / logout / token in addition to claims)
ctx.challenge(scheme, params?);  // append a WWW-Authenticate challenge
ctx.cookies;    // IPylonCookies
ctx.data;       // parsed request body (camelCased)
ctx.params;     // path parameters
ctx.request;    // Koa request augmented with body / files
ctx.session;    // { set, get, del, logout }
ctx.signal;     // AbortSignal tied to the request
ctx.io.app;     // Socket.IO server (when socket is enabled)
ctx.rooms?;     // members(), presence() — when rooms are enabled
ctx.socket?;    // emit(target, event, data?) — Pylon envelope emitter
```

Socket-only additions:

```typescript
ctx.ack;        // ack callback or null
ctx.args;       // raw event arguments
ctx.data;       // event payload
ctx.envelope;   // true if the event arrived as a Pylon envelope
ctx.event;      // event name
ctx.eventId;    // unique id assigned by the server
ctx.header;     // envelope headers (correlationId, …)
ctx.io.app;     // Socket.IO server
ctx.io.socket;  // raw Socket.IO socket
ctx.nack;       // nack callback or null
ctx.params;     // params extracted from parameterised event names
ctx.rooms?;     // join(), leave(), members(), presence()
ctx.socket?;    // emit() and broadcast() — Pylon envelope emitter
```

### App config

`ctx.state.app.config` is the ONE home for the deployment's resolved configuration and policy. It is built **once**, after `amphora.setup()`, and every request of **both transports** is handed the same deeply frozen object — nothing in it varies per request, and a handler cannot flip a policy for everything downstream of it.

```typescript
ctx.state.app.config.audit; // AppAuditConfig | false — { sanitise?, skip? }
ctx.state.app.config.responseCache; // AppResponseCacheConfig | false
ctx.state.app.config.rateLimit; // AppRateLimitConfig | false — { strategy, window, max, key?, skip? }
ctx.state.app.config.auth; // AppAuthConfig | null
```

`false` / `null` is OFF for every entry and an object is ON — there is no second `enabled` flag inside a policy free to disagree with the presence of the policy itself. `window` is resolved to **milliseconds**, because `useRateLimit` compares a mount's window against it. `responseCache` is an empty object today: every knob `useCache` reads is stated per mount, and the deployment only says whether the feature is on at all.

`auth` is `null` when no `auth` block is configured, and **reading it never throws** — it is eager state on every request of every pylon, including the ones with no auth at all.

```typescript
ctx.state.app.config.auth?.issuer; // string | null — from driver.endpoints()
ctx.state.app.config.auth?.clientId; // string | null — null for a verify-only driver
ctx.state.app.config.auth?.capabilities; // { introspect, userinfo } — derived from the driver
ctx.state.app.config.auth?.cache; // PylonAuthCacheConfig | false
```

`issuer` is `null` only when the driver's pinned scope resolves to nothing (no idp on amphora, or one whose issuer amphora never settled) — pylon warns once at setup, and the request paths that genuinely need an issuer still raise the driver's own named error. `clientId` is `null` for a verify-only driver, which is nobody's OAuth client. Either one missing means the driver-response cache has no key it is safe to share, so it steps aside and calls the driver.

`app`'s other members — `domain`, `environment`, `name`, `version` — are ambient identity, not policy, which is why they sit beside `config` rather than inside it.

## HTTP routing

### Programmatic routers

Pass an array of `{ path, router }` entries:

```typescript
const app = new Pylon({
  routes: [
    { path: "/api", router: apiRouter },
    { path: "/admin", router: adminRouter },
  ],
  // …
});
```

### File-based routing

Pass a directory string (or an array mixing strings and `{ path, router }` entries). Pylon scans recursively and maps files to routes.

```typescript
const app = new Pylon({
  routes: "./src/routes",
  // …
});
```

A directory tree like the one below is mapped as follows:

```
routes/
  _middleware.ts          → middleware shared by every route
  health.ts               → GET /health (and other exported methods)
  v1/
    _middleware.ts        → middleware shared by /v1/*
    users/
      index.ts            → /v1/users
      [id].ts             → /v1/users/:id
    proxy/
      [...path].ts        → /v1/proxy/* (catch-all)
```

| Filename / segment | Route segment | Description                               |
| ------------------ | ------------- | ----------------------------------------- |
| `users.ts`         | `/users`      | Literal segment                           |
| `index.ts`         | (none)        | Directory root handler                    |
| `[id].ts`          | `/:id`        | Dynamic parameter                         |
| `[...path].ts`     | catch-all     | Matches any remaining path                |
| `[[...slug]].ts`   | optional      | Optional catch-all                        |
| `(group)/file.ts`  | `/file`       | Group — directory name stripped from path |
| `_middleware.ts`   | (none)        | Middleware file, not a route              |

### Route file exports

Each file may export HTTP method constants — either a single handler or an array of middleware ending in a handler:

```typescript
export const GET = async (ctx) => {
  ctx.body = await listUsers();
  ctx.status = 200;
};

const validate = async (ctx, next) => {
  /* … */ await next();
};
const create = async (ctx) => {
  ctx.body = await insertUser(ctx.data);
  ctx.status = 201;
};

export const POST = [validate, create];
```

Recognised exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `STATIC` (see [Static assets](#static-assets)). Alternatively, default-export or name-export a `PylonRouter` instance for full control.

### Middleware inheritance

A `_middleware.ts` file at any directory level exports a `MIDDLEWARE` constant (single middleware or an array). Middleware is composed top-down: a handler at `routes/v1/users/[id].ts` runs root middleware first, then `v1` middleware, then any handler-local middleware, then the handler itself.

```typescript
// routes/_middleware.ts
export const MIDDLEWARE = [corsMiddleware, requestLoggingMiddleware];

// routes/v1/_middleware.ts
export const MIDDLEWARE = [bearerAuth];
```

### Static assets

A route file may export `STATIC` (exclusively — no other route exports in the same file) to serve a
directory at that route's subtree with CDN-correct semantics: `Content-Type` by extension, `ETag` +
`Last-Modified` with `304` revalidation, single-range `206`/`416`, `GET`/`HEAD` only (`405`
otherwise), and path-traversal/dotfile protection. Misses are uniform `404`s that never reveal what
exists on disk.

```typescript
// routes/assets.ts → GET/HEAD /assets/<path>
export const STATIC = useStatic({ root: "./assets", maxAge: "7d" });

// guards run first, like any route middleware
export const STATIC = [
  useAccess({ subject: "..." }),
  useStatic({ root: "/mnt/private", visibility: "private" }),
];
```

Options (`UseStaticOptions`):

- `root` — directory to serve; relative paths resolve against `process.cwd()`.
- `maxAge` — `ReadableTime` or milliseconds; default `0` (always revalidate).
- `immutable` — add `immutable` for content-hashed filenames; default `false`.
- `visibility` — `"public"` (default) or `"private"`. Guarded mounts must set `"private"` so shared
  caches never store authenticated assets.
- `precompressed` — serve `.br`/`.gz` siblings by `Accept-Encoding` (brotli preferred); adds
  `Vary: Accept-Encoding` and per-encoding `ETag`s; default `false`.
- `directoryListing` — serve directory hits as a JSON array (`name`, `type`, `size`,
  `last_modified`, dotfiles excluded, `Cache-Control: no-store`) instead of `404`; default `false`.

`_middleware.ts` inheritance applies as usual. Programmatic routers use the same pieces:
`router.static("/assets", useStatic({ root: "./assets" }))`. Symlinks are followed — keep the root
deploy-controlled.

### Upload mounts

The write side of static assets. A route file may export `UPLOAD` (exclusively, like `STATIC`) to
accept multipart uploads into a directory — typically the same volume a `STATIC` mount serves.
Requires multipart parsing: `parseBody: { multipart: true, formidable: true }`.

```typescript
// routes/admin/assets.ts → POST/PUT /admin/assets/<subdir…>
export const UPLOAD = [
  useAccess({ ... }),
  useUpload({ root: "/mnt/assets", prefix: "/assets", extensions: [".jpg", ".png"] }),
];
```

- `POST /admin/assets/gallery` — uploads any number of files into `gallery/` (subdirectories are
  created recursively; guard middleware authorizes them); the server names each file per `naming`.
  Responds `201` with `{ files: [{ name, path, size, mime_type, original_name }] }`, where `path`
  is the serving URL when `prefix` is set (`/assets/gallery/f_….jpg`).
- `PUT /admin/assets/gallery/f_….jpg` — create-or-replace at the exact URL path, one file per
  request. `201` created, `200` replaced; replacing requires `overwrite: true`, else `409`.
- Writes are atomic (temp file + same-dir rename/link), so a co-located `STATIC` mount never
  serves a half-written file. Path rules match `STATIC`: no traversal, no dotfiles.

Options (`UseUploadOptions`):

- `root` — target directory; relative paths resolve against `process.cwd()`.
- `prefix` — serving URL prefix used to build response `path`s; unset → root-relative paths.
- `naming` — `"random"` (default, `f_<base62×32>` + original extension), `"uuid"`, `"hash"`
  (content sha-256, re-uploading identical content dedupes idempotently — pairs with `immutable`
  static mounts), `"original"` (client filename, validated — never sanitized). PUT ignores
  `naming`; the URL is the name.
- `extensions` / `mimeTypes` — allowlists; `maxSize` (bytes) / `maxFiles` — per-file / per-request
  limits. All files are validated before any file is persisted.
- `overwrite` — allow replacing existing files (default `false`).

Uploaded files are also exposed on `ctx.files` (`IPylonFileUpload`). Programmatic form:
`router.upload("/admin/assets", guard, useUpload({ root: "/mnt/assets" }))`. In multi-replica
deployments the root must be a shared volume.

### Handler responses

`useHandler` lets a route return a plain object describing the response. It supports body, redirect, location header, file, and stream responses.

```typescript
import { useHandler } from "@lindorm/pylon";

router.post(
  "/users",
  useHandler(async (ctx) => {
    const user = await createUser(ctx.data);
    return {
      status: 201,
      body: { id: user.id, name: user.name },
      location: `/users/${user.id}`,
    };
  }),
);

router.get(
  "/old",
  useHandler(async () => ({ redirect: "https://example.com/new" })),
);

router.get(
  "/download",
  useHandler(async () => ({
    file: { path: "/path/to/report.pdf", options: { immutable: true, maxAge: 86400 } },
  })),
);

router.get(
  "/export",
  useHandler(async () => ({
    stream: {
      stream: createReadStream("/data/export.csv"),
      contentLength: 10240,
      lastModified: new Date(),
      mimeType: "text/csv",
      filename: "export.csv",
    },
  })),
);
```

## Socket.IO integration

Enable the gateway with `socket: { enabled: true }`. Listeners accept either `PylonListener` instances or a directory string for file-based scanning.

### Programmatic listeners

```typescript
const app = new Pylon({
  socket: { enabled: true, listeners: [chatListener, adminListener] },
  // …
});
```

### File-based listeners

```typescript
const app = new Pylon({
  socket: { enabled: true, listeners: "./src/listeners" },
  // …
});
```

```
listeners/
  _middleware.ts        → middleware shared by every event
  echo.ts               → event "echo"
  disconnect.ts         → event "disconnect"
  chat/
    _middleware.ts      → middleware shared by chat:*
    message.ts          → event "chat:message"
  rooms/
    [roomId]/
      join.ts           → event "rooms:{roomId}:join"
      leave.ts          → event "rooms:{roomId}:leave"
```

A listener file exports `ON` and/or `ONCE` — a single handler or an array of middleware followed by the handler:

```typescript
export const ON = async (ctx) => {
  ctx.ack?.({ text: ctx.data?.text, event: ctx.event });
};

const validate = async (ctx, next) => {
  /* … */ await next();
};
const handle = async (ctx) => {
  /* … */
};
export const ONCE = [validate, handle];
```

### Connection middleware vs event middleware

`socket.middleware` runs once per event; `socket.connectionMiddleware` runs once during the Socket.IO handshake before any events are accepted. Use `connectionMiddleware` for authentication and any setup that should fail the handshake outright on error.

```typescript
import { Pylon, useAccessToken } from "@lindorm/pylon";

const app = new Pylon({
  socket: {
    enabled: true,
    listeners: "./src/listeners",
    connectionMiddleware: [useAccessToken()],
  },
  // …
});
```

`useAccessToken` is the SAME mount used on an http router and on a socket
listener — it dispatches on the context it is handed, and takes no issuer (see
[Authentication](#authentication)).

### Auth refresh protocol

When `useAccessToken` in `connectionMiddleware` (or the auto-wired session connection middleware) populates auth state at handshake time, Pylon registers a refresh listener for the reserved events:

| Event                 | Direction       | Purpose                                                          |
| --------------------- | --------------- | ---------------------------------------------------------------- |
| `$pylon/auth/refresh` | client → server | Replace bearer / re-read session and refresh expiry              |
| `$pylon/auth/expired` | server → client | Advisory event emitted once inside the pre-expiry warning window |

After the handshake, `useAccessToken` does not re-verify the token on every event. It checks the expiry on the stored auth state — accepted silently if well before expiry, accepted with one `$pylon/auth/expired` emission inside the warning window, and rejected (with the socket disconnected for session strategy) once expired.

### Rooms

Enable with the `rooms` option on the constructor:

```typescript
const app = new Pylon({
  rooms: { presence: true },
  kv: keyValueSource,
  // …
});
```

`ctx.rooms` and `ctx.socket` are then available on both transports.

```typescript
// in a socket listener
listener.on("game:start", async (ctx) => {
  await ctx.rooms?.join("game-lobby");
  const members = await ctx.rooms?.members("game-lobby");
  ctx.socket?.broadcast("game-lobby", "game:player-joined", { userId: ctx.data.userId });
});

// in an HTTP handler
router.post(
  "/notify/:userId",
  useHandler(async (ctx) => {
    ctx.socket?.emit(`user:${ctx.params.userId}`, "alert", { message: "hello" });
    return { status: 204 };
  }),
);
```

| Method (room context)             | HTTP | Socket | Description                                                    |
| --------------------------------- | ---- | ------ | -------------------------------------------------------------- |
| `join(room)`                      | —    | yes    | Add the socket to a room                                       |
| `leave(room)`                     | —    | yes    | Remove the socket from a room                                  |
| `members(room)`                   | yes  | yes    | Returns Socket.IO socket ids in the room                       |
| `presence(room)`                  | yes  | yes    | Returns `{ userId, socketId, joinedAt }` (requires `presence`) |
| `emit(target, event, data?)`      | yes  | yes    | Emit a Pylon envelope to the target                            |
| `broadcast(target, event, data?)` | —    | yes    | Like `emit` but excludes the calling socket                    |

`presence` requires `rooms.presence: true` and a `kv` source — Pylon registers a `Presence` entity at startup and writes a record on each `join`. It lives in `kv`, not `cache`: an evicted presence record silently drops a member from a live room.

### Redis adapter

```typescript
import Redis from "ioredis";

const app = new Pylon({
  socket: {
    enabled: true,
    redis: new Redis("redis://localhost:6379"),
  },
  // …
});
```

## Middleware

All middleware below is exported from the package root.

### Authentication

```typescript
import {
  createBasicAuthMiddleware,
  createTokenMiddleware,
  useAccessToken,
} from "@lindorm/pylon";

// No issuer: it verifies against `auth.driver`'s, resolved once at boot.
const accessAuth = useAccessToken({ audience: "my-api" });

const basicAuth = createBasicAuthMiddleware([{ username: "admin", password: "secret" }]);

// Or a custom verifier
const dynamicBasic = createBasicAuthMiddleware(async (username, password) => {
  if (!(await verify(username, password))) throw new ClientError("Invalid credentials");
});

// Generic JWT verification at any context path
const verifyApiKey = createTokenMiddleware({
  contextKey: "apiKey",
  issuer: "https://keys.example.com",
});
router.use(verifyApiKey("request.body.apiKey"));
```

`useAccessToken` is ONE mount for all three surfaces — an http router, `socket.connectionMiddleware`, and a socket listener — dispatching on the context it is handed:

| Surface          | What it does                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| HTTP request     | resolves the bearer / DPoP / session-derived access token onto `ctx.state.access`                    |
| Socket handshake | verifies the credential once and registers the auth state (strategy, expiry, refresh) for the socket |
| Socket event     | fast path over that state — re-checks EXPIRY, not the signature                                      |

⚠ **It takes no `issuer`.** The issuer is `ctx.state.app.config.auth.issuer`, settled once at boot by amphora for the scope `auth.driver` named — so an `auth` block is required to mount it. A service that mints the tokens it verifies configures `new JwtDriver({ issuer: "self" })`; a resource server pinning an upstream with no discovery document uses `"idp"`. Verifying with no issuer matcher is not a weaker check but NO check, so a deployment that resolved none is refused by name (`access_issuer_unresolved`) on the paths that verify locally. The opaque path is unaffected — RFC 7662 makes the authorization server the authority there.

`{ dpop: "required" | "optional" | "disabled" }` sets how strictly the HANDSHAKE treats DPoP (default `"optional"`). It is handshake-only: on HTTP the scheme states the intent per request.

`createTokenMiddleware({ issuer })` is the DIFFERENT case and keeps its per-mount issuer — it accepts tokens signed by issuers that are not ours, of which amphora carries an array.

#### Resolved access — `ctx.state.access`

On HTTP the middleware **sniffs the credential's wire format and routes** — it never tries a local verify and treats the failure as "must be opaque", because a tampered JWT has to fail rather than be handed to an authorization server that never issued it.

| Credential                          | Route                                   | Result                                                           |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| JOSE / COSE (`Aegis.isJose/isCose`) | verified locally against your keys      | `ctx.state.access` **and** `ctx.state.tokens.accessToken`        |
| anything else (opaque)              | `ctx.auth.introspect(token)` (RFC 7662) | `ctx.state.access` only — there is no `VerifiedToken` to publish |

Both paths produce the same three-field shape, so every downstream gate reads one place:

```typescript
ctx.state.access; // PylonResolvedAccess | null
// {
//   provenance: "verified" | "introspected",  // signature checked here, vs the AS asserting it
//   claims: DomainClaims,                     // domain-keyed camelCase on BOTH paths
//   token: string,                            // the presented credential
// }
```

`cnf` lives inside `claims.confirmation`, so it is not repeated on the outside; there is no `header` field (an opaque token has none, and a JWT's is derivable from `token`) and no `active` field (an inactive token throws `token_not_active` instead of resolving).

A service that mints and verifies its own tokens needs **no `auth` configuration at all** — nothing on the JOSE/COSE path calls the IdP. Introspection is only reached by a genuinely opaque credential, and that needs an `auth` driver that implements `introspect`. Without one, an opaque credential is refused as `opaque_token_not_supported` (401) rather than as a verification that failed.

#### Driver-response cache

An opaque credential costs one introspection call per request, and every profile read costs a userinfo call. The cache in front of them is off unless a deployment asks for it:

```typescript
new Pylon({
  cache: cacheSource, // or just `kv` — `cache` falls back to it
  auth: {
    driver: new OpenIdResourceDriver({ clientId, clientSecret }),
    cache: {
      enabled: true,
      introspection: { ttl: "10 seconds" }, // or `false` to switch this half off
      userinfo: { ttl: "5 minutes" }, //        …independently of the other
    },
  },
});
```

| Setting               | Meaning                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cache.enabled`       | Off when the block is absent. RFC 7662 §5 expects a deployment to be able to refuse caching. **Cache policy only** — the capabilities are `driver.introspect` / `driver.userinfo` |
| `cache.introspection` | `false` switches introspection caching off. `ttl` is the deployment default; built-in `10 seconds`                                                                                |
| `cache.userinfo`      | `false` switches userinfo caching off. `ttl` is the deployment default; built-in `5 minutes`                                                                                      |
| `encryption`          | KEK selector for both stored payloads. Default `{ condition: { purpose: "pylon:kek" } }`                                                                                          |

Both entities live in the top-level `cache` source (falling back to `kv`) — a cached answer is disposable by construction. **No ephemeral source ⇒ no cache**: the driver is called every request, without error.

⚠ **The two TTLs are not the same kind of number, which is why there is no shared one.** Introspection's IS the revocation window: RFC 7662 §5 warns that caching opens "a window during which a revoked token could be used at the protected resource", so it is measured in seconds — for `active: false` answers as much as for live ones. An entry is additionally bounded by the token's own `exp`, and caching to that `exp` is explicitly _not_ what this does: an opaque token that is never re-checked is a JWT without revocation. Userinfo's is a staleness tolerance on profile claims — no authorization decision rides on it — so it is measured in minutes.

The introspection TTL resolves in three tiers, and a single mount may only ever narrow:

```typescript
// Shorter window on a sensitive mount…
router.use(useAccessToken({ cache: { ttl: "2 seconds" } }));

// …or none at all: introspect on every request, whatever the deployment says.
router.use(useAccessToken({ cache: false }));
```

Both keys are a digest of `(kind, token, issuer, clientId)` — never the raw token, which would land readable in shared storage. **The token, never the subject**: two tokens for one subject can carry different scopes, and both answers vary by granted scope (RFC 7662 §2.2 lets the authorization server "limit which scopes from a given token are returned for each protected resource"; OIDC Core §5.3 returns exactly the profile claims the token's scopes authorise). The identity is part of it for the same reason — keying on the token alone would let two services sharing a namespace read each other's answers. Both inputs come from the **driver** — `endpoints().issuer` and its own client id — because RFC 7662 §2.1 has the resource server authenticate to the introspection endpoint, and those credentials may legitimately differ from a relying party's. `ctx.state.app.config.auth` exposes that identity (`{ issuer, clientId }`, and never the client secret); either one `null` means there is no key safe to share, so the cache steps aside and calls the driver.

The caching is **inside** `ctx.auth.introspect` / `ctx.auth.userinfo` rather than in front of them, so there is no uncached path a caller can pick by mistake. A sensitive route opts out per call with `ctx.auth.introspect(token, { cache: false })` — which `useAccessToken({ cache })` forwards for the mount.

Nothing is cached when either call fails — a stale answer served over an unreachable authorization server is a revocation bypass, and a cached userinfo failure would outlive its own cause — and a storage outage degrades to an uncached call rather than failing the request. **There is no negative userinfo entry at all**: userinfo returns a profile or it errors, and "is this token still good?" is introspection's question, under introspection's far shorter window.

Both payloads are encrypted at rest. The cached profile is stored as the domain object under `@TypedJson`, not in claim wire form: the wire translation snake-keys the nested OIDC Core §5.1 `address` on the way out and returns it verbatim on the way in, so a wire-form payload would answer a cache hit differently from a miss.

**DPoP (RFC 9449)** is checked from `(proof, claims.confirmation.thumbprint, token)`, so it runs identically on both paths — RFC 9449 §6.2 conveys `cnf.jkt` in the introspection response precisely so a resource server can validate the binding locally for an opaque token. A token carrying `cnf.jkt` is refused without a matching proof (`missing_dpop_proof`), and a token _without_ `cnf.jkt` presented under the `DPoP` scheme is refused as `token_not_dpop_bound`.

### Authorization

```typescript
import { useAccess, usePermissions, useRoles, useValidation } from "@lindorm/pylon";

router.post("/admin", useRoles("admin", "superadmin"), handler);
router.delete("/users/:id", usePermissions("users:write", "users:delete"), handler);

router.put(
  "/sensitive",
  useAccess({
    roles: ["admin"],
    permissions: ["data:write"],
    scope: ["openid", "profile"],
    levelOfAssurance: 3,
    adjustedAccessLevel: 2,
  }),
  handler,
);

router.use(useValidation("accessToken", { issuer: "https://auth.example.com" }));
```

`useRoles` and `usePermissions` accept a trailing `{ token: "<key>" }` to read from a non-default token (default: `accessToken`). `useAccess` takes the same option.

At the default key, `useAccess` and `usePermissions` read `ctx.state.access.claims` — the resolved credential, whatever established it — so they work unchanged on a locally verified token and on an introspected one. They throw `access_not_resolved` (401) when `useAccessToken` has not run ahead of them. Named keys (`{ token: "idToken" }`) address one entry of `ctx.state.tokens` instead, which is a different question and keeps reading the parsed token.

### Validation

`useSchema` validates a value on the context using a Zod object schema and writes the parsed value back.

```typescript
import { useSchema } from "@lindorm/pylon";
import { z } from "zod";

const CreateUser = z.object({
  name: z.string().min(1),
  email: z.email(),
  age: z.number().int().min(0).optional(),
});

router.post(
  "/users",
  useSchema(CreateUser), // defaults to "data"
  useSchema(SearchSchema, "query"),
  useSchema(HeadersSchema, "headers"),
  useHandler(async (ctx) => ({ status: 201, body: ctx.data })),
);
```

Recognised paths: `"data"` (default), `"body"`, `"headers"`, `"params"`, `"query"`, or any `object-path` expression on the context. The HTTP-only paths (`body`, `headers`, `query`) throw a `ServerError` if the middleware runs on a socket context.

### Multi-tenancy

```typescript
import { useScope, useTenant } from "@lindorm/pylon";

// Resolve tenant from access-token introspection (default)
router.use(useTenant());

// Or read from any object-path
router.use(useTenant("state.tokens.apiKey.claims.tenantId", { required: true }));

// Apply a Proteus filter on every query in the request
router.use(useScope({ params: (ctx) => ({ tenantId: ctx.state.tenant }) }));
```

`useTenant` defaults to `required: true`, sets `ctx.state.tenant`, and (when a tenant is found and a Proteus session exists) installs a `__scope` filter param.

### Rate limiting

```typescript
import { useRateLimit } from "@lindorm/pylon";

router.use(useRateLimit()); // the deployment's own window, ceiling and strategy
router.use(useRateLimit({ window: "1m", max: 60 })); // fixed (default)
router.use(useRateLimit({ window: "1m", max: 60, strategy: "sliding" }));
router.use(useRateLimit({ window: "1m", max: 60, strategy: "token-bucket" }));

router.use(
  useRateLimit({
    window: "15m",
    max: 100,
    key: (ctx) => ctx.state.tokens.accessToken?.claims.subject ?? "anon",
    skip: (ctx) => false,
  }),
);
```

`useRateLimit` requires `rateLimit: { enabled: true }` on the constructor (which also wires the entities into the evictable source, `cache ?? kv`). HTTP responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-RateLimit-Strategy`; rejected requests also include `Retry-After`.

**Every option is optional and only ever NARROWS the deployment's own**, which lives on `ctx.state.app.config.rateLimit` — so "never rate-limit health checks" is stated once, as `rateLimit.skip`, and holds for a mount that says nothing about it. A mount that states neither its own limits nor inherits any throws `rate_limit_not_bounded` rather than silently doing nothing.

When `rateLimit.window` and `rateLimit.max` are set on the constructor, Pylon installs a global `useRateLimit()` automatically — with no arguments, so there is no closure copy of the limits free to disagree with the one every route-level mount reads.

### Response cache

```typescript
import { useCache } from "@lindorm/pylon";

// Cache a public response for 60 seconds (shared across all callers).
router.get("/articles", useCache("60s", "public"), useHandler(listArticles));

// Cache a per-user response (the resolved actor is folded into the cache key).
router.get("/me/feed", useCache("30s", "private"), useHandler(myFeed));

// Vary by request headers, skip selected requests, or key on a custom identity.
router.get(
  "/products",
  useCache("5m", "public", {
    vary: ["Accept-Language"],
    skip: (ctx) => ctx.query.fresh === "true",
  }),
  useHandler(listProducts),
);

// Scope a private cache by tenant instead of the request actor.
router.get(
  "/dashboard",
  useCache("30s", "private", {
    actor: (ctx) => ctx.state.tokens.accessToken.claims.tenantId,
  }),
  useHandler(dashboard),
);
```

`useCache(ttl, scope, options?)` slots after `useSchema` (it folds `ctx.data` into the
key) and before `useHandler`. It requires `responseCache: { enabled: true }` on the
constructor, which wires the `CachedResponse` entity into the evictable source
(`cache ?? kv`).

- `ttl` accepts a `ReadableTime` (e.g. `"60s"`) or a number of milliseconds.
- `scope`:
  - `"public"` — one shared entry per request shape; the actor is ignored.
  - `"private"` — the resolved actor is folded into the key, so each actor gets its own
    entry. The actor defaults to pylon's `resolveActor` (access-token sub → id-token sub →
    basic-auth user) and can be overridden per route with `options.actor`. A private request
    with no resolvable actor is **never cached** (it would leak under a global key) — it is
    served straight from the handler and logs a warning so the misconfiguration is visible.
- The cache key is a SHA-256 of the method, path, the key-sorted `ctx.data`, the actor
  (private scope only), and the configured `vary` header values, so reordered request data
  collapses to a single entry.

Request `Cache-Control` directives are honored: `no-store` bypasses the cache entirely;
`no-cache` (or `max-age=0`, or `Pragma: no-cache`) skips the read and refreshes the stored
entry; `If-None-Match` (exact or `*`) yields a `304 Not Modified` on a hit. Only successful
(`2xx`), non-streaming, non-redirect responses within a 1 MiB body cap are stored.

Emitted headers (the proprietary status headers are namespaced `X-Pylon-Cache*` so they don't
collide with a CDN/proxy's own `X-Cache` in the response chain):

- `X-Pylon-Cache` (always) — `HIT` (served from cache, incl. a coalesced single-flight
  replay), `MISS` (computed fresh and stored), `DYNAMIC` (computed but not eligible to store —
  `3xx`/stream/`>=400`/over the size cap/`private` with no actor), or `BYPASS` (caching
  skipped by request `no-store` or `skip()`).
- `ETag` (strong, on cacheable responses), `Cache-Control: <public|private>, max-age=<seconds>`,
  `Age` (seconds since the stored representation was captured), `Vary` (when configured).
- `X-Pylon-Cache-Source: <driverType>` — outside `production` only (so the backend isn't
  advertised publicly).

Concurrent misses for the same key are coalesced in-process via single-flight: only one
handler runs and its result is replayed to the waiters. This is per-Pylon-process and **not**
distributed — across multiple containers each process may run the handler once, which is
acceptable by design (the shared `cache` source still de-duplicates the stored entry). A
cache backend outage degrades gracefully: read/write failures are logged and the handler is
served, never failing the request.

### Audit logging

```typescript
import { useAuditLog } from "@lindorm/pylon";

router.use(
  useAuditLog({
    sanitise: (body) => ({ ...body, password: "[REDACTED]" }),
    skip: (ctx) => ctx.path === "/health",
  }),
);
```

`useAuditLog` requires `audit: { enabled: true }` on the constructor and a `bus` source. `audit.enabled` is the **whole** switch: off means the middleware passes through silently, whatever else is or is not configured, and on with no `bus` throws `audit_bus_not_configured`. The record is published through `ctx.bus` — the request-scoped session, so it carries this request's actor and correlation id. `sanitise` and `skip` are stated per deployment (`audit.sanitise` / `audit.skip`) or per mount, and the mount wins. Each request publishes a `RequestAudit` message containing the endpoint, method, transport, status, duration, source IP, session id, user agent, request id, correlation id, actor, and the (optionally sanitised) body. Set `audit.entities` to a list of entity classes for entity-level change tracking — Pylon installs Proteus listeners on those entities and persists field-level diffs into `DataAuditLog`.

### Conduits (HTTP clients)

```typescript
import { createConduitMiddleware } from "@lindorm/pylon";

router.use(
  createConduitMiddleware([
    { alias: "userService", baseUrl: "http://user-service:4000" },
    { alias: "paymentService", baseUrl: "http://payment-service:4001" },
  ]),
);

router.post(
  "/checkout",
  useHandler(async (ctx) => {
    const user = await ctx.conduits.userService.get("/users/me");
    const payment = await ctx.conduits.paymentService.post("/charges", {
      body: { amount: 100 },
    });
    return { body: { user, payment } };
  }),
);
```

The middleware forwards the current correlation id and session id (when present) and converts response keys to camelCase.

### Iris helpers

`createPublisherMiddleware([Message])` exposes lazy publishers under `ctx.publishers.<camelCasedMessageName>`. `createWorkerQueueMiddleware([Message])` does the same on `ctx.workerQueues`. Both accept an optional second argument to override the global Iris source.

### Attaching extra Proteus / Iris sources

Use `createAttachProteusSourceMiddleware` and `createAttachIrisSourceMiddleware` to expose additional sources on a custom context key — useful when an app needs more than one source (for example postgres for durable state and redis for short-lived caches).

```typescript
router.use(
  createAttachProteusSourceMiddleware({ key: "cacheProteus", source: redisSource }),
);
```

### Signed requests

`createHttpSignedRequestMiddleware` verifies an inbound `Signature`/`Digest` header pair against a `Kryptos` resolved by key id. `conduitSignedRequestMiddleware` is the matching outbound middleware for `@lindorm/conduit` callers.

## OpenID Connect

Pylon talks to an identity provider through an **auth driver**. The driver owns everything that varies by provider — where the endpoints are, how the authorization query is spelled, how the token request is encoded and authenticated, what userinfo and introspection look like, and whether logging out is a redirect, a revocation, or nothing at all. Pylon keeps everything a driver could weaken by omission: `state`, `nonce`, PKCE, cookie sealing, the `redirect_uri` allowlist, token verification, session assembly and the routes themselves.

**⭐ Amphora fetches, the driver shapes.** Amphora owns every issuer and every key, and does all of its fetching at ITS setup: `amphora.internal` is this service's own identity, `amphora.idp` the single upstream, `amphora.external` any foreign ones. A driver declares no issuer of its own — **which scope a deployment uses is stated by WHICH DRIVER it picks**, and `endpoints()` is synchronous so a driver that tried to fetch would not compile.

```typescript
import { Amphora } from "@lindorm/amphora";
import { OpenIdDriver } from "@lindorm/pylon";

// The issuer is declared HERE, once. This registration is what fetches the
// discovery document and the provider's keys.
const amphora = new Amphora({
  logger,
  internal: { issuer: "https://api.example.com" },
  idp: { issuer: "https://auth.example.com" },
});

const app = new Pylon({
  amphora,
  auth: {
    driver: new OpenIdDriver({
      clientId: "my-client-id",
      clientSecret: "my-client-secret",
      authorize: { scope: ["openid", "profile", "email"] },
    }),
    refresh: { mode: "half_life" },
    router: {
      pathPrefix: "/auth",
      errorRedirect: "/error",
      dynamicRedirectDomains: ["https://app.example.com"],
    },
    session: { enabled: true },
  },
  // …
});
```

| `auth` setting       | Meaning                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `driver`             | **Required.** How pylon talks to the provider — see the drivers below                                                             |
| `router`             | Mounts the login/logout routes under `pathPrefix`. Omit it entirely for a pure resource server                                    |
| `session`            | The session cookie and its `Session` store — see [Sessions](#sessions)                                                            |
| `encryption`         | KEK selector for the cached payloads. Default `{ condition: { purpose: "pylon:kek" } }`                                           |
| `cache`              | Driver-response caching — RFC 7662 introspection and OIDC Core §5.3 userinfo; see [Driver-response cache](#driver-response-cache) |
| `refresh`            | When to auto-refresh a session's tokens                                                                                           |
| `defaultTokenExpiry` | Fallback session lifetime when the token response carries no expiry. Default `1d`                                                 |

Client credentials and the authorization request's defaults are the **provider's**, so they live on the driver, not on `auth`. The **issuer** lives on neither — it is amphora's.

### Drivers

| Driver                 | Reads                        | Capabilities                                                   | Use for                                                                                               |
| ---------------------- | ---------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `OpenIdDriver`         | `amphora.idp`                | Everything, backed by `.well-known/openid-configuration`       | Any standard OP — tyr, Auth0, Google                                                                  |
| `OpenIdResourceDriver` | `amphora.idp`                | `introspect` · `userinfo` · `subject` only                     | An API service that validates tokens and never logs anyone in                                         |
| `Auth0Driver`          | `amphora.idp`                | `OpenIdDriver`, with the resource indicator sent as `audience` | Auth0 tenants without the RFC 8707 compatibility profile                                              |
| `JwtDriver`            | `amphora.internal` OR `.idp` | `endpoints()` only — verify-only, no network, no client id     | A service that mints its own tokens, or an upstream that publishes no discovery document              |
| `PylonAuthDriverBase`  | whatever the subclass reads  | The OAuth2 mechanics, with `endpoints()` abstract              | A provider that publishes no discovery document (GitHub, Discord) — return the endpoints as a literal |

`JwtDriver` is the smallest possible driver: it pins one of amphora's two own-side issuer scopes and returns `null` for every endpoint.

```typescript
new JwtDriver({ issuer: "self" }); // this service IS the issuer → amphora.internal
new JwtDriver({ issuer: "idp" }); //  the registered upstream    → amphora.idp
```

The scope is **required and has no default**: a service can federate, holding its own issuer _and_ an upstream, so which one its tokens come from is not derivable. An unconfigured scope throws by name — pylon's `self_issuer_not_configured`, or amphora's own `idp_not_configured` / `idp_issuer_unresolved` (registered, but with no issuer settled yet).

Use it when `OpenIdResourceDriver` cannot serve the upstream: an amphora `idp` may be registered by an issuer + `jwksUri` pair with no `.well-known/openid-configuration` behind it, and the resource driver needs that document.

**Every capability method is optional, and an omitted method IS the capability declaration.** There is no flag that can disagree with reality: a provider with no refresh grant simply has no `refresh`, and pylon reports the configured mode as unhonourable rather than silently never refreshing.

```typescript
class GitHubDriver extends PylonAuthDriverBase {
  endpoints() {
    return {
      issuer: "https://github.com",
      authorizationEndpoint: "https://github.com/login/oauth/authorize",
      tokenEndpoint: "https://github.com/login/oauth/access_token",
      userinfoEndpoint: "https://api.github.com/user",
      introspectionEndpoint: null,
      revocationEndpoint: null,
      endSessionEndpoint: null,
    };
  }
}
```

Drivers are not required to extend anything — `IPylonAuthDriver` is the contract. A driver never receives the request context, only a narrow read-only one (`aegis`, `amphora`, a correlation-tagged `conduit`, `environment`, `kv`, `logger`), so it cannot touch a cookie or the session even deliberately. `aegis` grants no authority `amphora` did not already carry — it is a wrapper over the same vault — it is there so a driver can mint the signed client assertion below.

`kv` is pylon's **authoritative** ephemeral source as a request-scoped `IProteusSession` (this request's logger and hook meta already attached), `undefined` when the deployment configured none. It is there for a driver that resolves an opaque token against its own store rather than an HTTP introspection endpoint — an authoritative lookup, which is why it is `kv` and never the evictable `cache`. It is the only storage on this seam: still no cookies, no session writes, no `ctx.state`.

### Client authentication

The driver authenticates every token-endpoint and introspection request. Pylon composes five of the IANA-registered methods and picks one per request (RFC 6749 §2.3 allows at most one), negotiating from the provider's `token_endpoint_auth_methods_supported` unless `tokenEndpointAuthMethod` pins it.

| Method                | What crosses the wire                          | Needs                   |
| --------------------- | ---------------------------------------------- | ----------------------- |
| `private_key_jwt`     | A JWT signed with the client's own private key | `clientAssertion.key`   |
| `client_secret_jwt`   | A JWT MAC'd with the client secret             | `clientSecret` (≥ 16 B) |
| `client_secret_basic` | The secret, in the `Authorization` header      | `clientSecret`          |
| `client_secret_post`  | The secret, in the form body                   | `clientSecret`          |
| `none`                | `client_id` alone (RFC 6749 §3.2.1)            | nothing                 |

Negotiation walks that table top-down and takes the first method the provider advertises **and** the driver holds the credential for. The order is by what a compromise costs: asymmetric proof first (the provider stores only a public key, so breaching it yields nothing that can impersonate the client), then the MAC'd assertion (the secret itself never crosses the wire — only a short-lived, single-use `jti`-bearing JWT does), then the two that put the secret on the wire, header before body because the `Authorization` header is what log scrubbers already redact.

**Capability comes from the driver, not from the provider.** A driver with no `clientAssertion.key` cannot compose `private_key_jwt` however loudly the provider advertises it, so negotiation skips the method rather than reaching for whatever key the deployment happens to sign with — and pinning it throws instead. A provider advertising only methods the driver cannot compose gets the spec default, plus a `warn`.

The RFC 8705 mTLS methods (`tls_client_auth`, `self_signed_tls_client_auth`) are **not** built in: they prove a client certificate during the TLS handshake rather than by a signature, so they are settled on the HTTP agent. A driver that needs one attaches its own conduit middleware.

```typescript
new OpenIdDriver({
  clientId: "my-client-id",
  clientAssertion: {
    key: { condition: { purpose: "client_assertion" } }, // an amphora key…
    // key: { kryptos },                                 // …or one supplied outright
    expiry: "1 minute",
  },
});
```

| `clientAssertion` setting | Meaning                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`                     | The aegis signing-key selector `private_key_jwt` uses. Default `null` — the method is then not composable. Its public half must be registered with the provider |
| `expiry`                  | The assertion's lifetime. Default `1 minute` — OIDC Core §9 has these tokens used once                                                                          |

The assertion carries `iss` = `sub` = the client id, a fresh `jti`, `exp`, `iat`, and `aud` = the **token endpoint URL** — RFC 7523 §3 only asks for a value identifying the authorization server, but OIDC Core §9 narrows it to the token endpoint for both assertion methods, so that value satisfies both. A provider wanting its issuer identifier instead overrides `clientAssertionAudience` on `PylonAuthDriverBase`.

⚠ `client_secret_jwt` MACs with the **UTF-8 octets of the client secret verbatim** (OIDC Core §9) — nothing is derived from it, because the provider reproduces the MAC from exactly those octets. A secret shorter than the MAC key size HS256 requires (16 bytes) is refused rather than stretched; that floor is OIDC Core §16.19's.

### Boot validation

At `setup()` pylon holds the configuration against what the driver can serve. The test is whether there is a coherent thing to do without the capability:

| Configuration                                        | Result                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `router` set, driver has no `authorize`/`exchange`   | **Throws** `auth_driver_cannot_serve_router` — `/login` is mounted and cannot work |
| `refresh.mode !== "none"`, driver has no `refresh`   | Warns once. Refresh is off                                                         |
| `cache.introspection` on, driver has no `introspect` | Warns once. That half of the cache is dead, not broken                             |
| `cache.userinfo` on, driver has no `userinfo`        | Warns once. That half of the cache is dead, not broken                             |

### Refresh

| Refresh mode | Behaviour                                                           |
| ------------ | ------------------------------------------------------------------- |
| `force`      | Refresh on every request that goes through the refresh middleware   |
| `half_life`  | Refresh once the request crosses the half-life of the current token |
| `max_age`    | Refresh after `refresh.maxAge` since `issuedAt`                     |
| `none`       | Never auto-refresh                                                  |

`half_life` needs a known expiry to find a midpoint, so a session whose `expiresAt` is null is never refreshed under that mode — use `max_age` or `force` to refresh regardless of lifetime.

A session that holds no refresh token — one established without `offline_access` — is never refreshed under any mode. The middleware skips it and leaves it intact until its own expiry; it does not attempt the grant and does not clear the session.

| Route                              | Description                                                            |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `GET /:prefix/login`               | Start the authorize flow — sets the login cookie, redirects to the IdP |
| `GET /:prefix/login/callback`      | Handle the authorize callback, exchange the code, set the session      |
| `GET /:prefix/logout`              | Start RP-initiated logout                                              |
| `GET /:prefix/logout/callback`     | Handle the IdP's post-logout redirect                                  |
| `POST /:prefix/backchannel-logout` | Handle RP-initiated backchannel logout                                 |
| `GET /:prefix/refresh`             | Force-refresh the session's tokens                                     |
| `GET /:prefix/userinfo`            | Return `ctx.auth.userinfo()` (id-token fast path with driver fallback) |
| `GET /:prefix/introspect`          | Return `ctx.auth.introspect()` (RFC 7662 metadata)                     |
| `GET /:prefix/error`               | OIDC error landing page                                                |

`ctx.auth.userinfo()` answers _who is this user?_ — it parses the id token locally when possible and falls back to the IdP's userinfo endpoint. `ctx.auth.introspect()` answers _is this token valid, what can it do, when does it expire?_.

| `ctx.auth`                     | Available on  | Notes                                                                                                                            |
| ------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `introspect(token?, options?)` | HTTP + socket | Local fast path first, then `driver.introspect` — with the RFC 7662 §5 cache built in. `options.cache: false` opts this call out |
| `userinfo(token?)`             | HTTP + socket | Local fast path first, then `driver.userinfo` — with the OIDC Core §5.3 cache built in                                           |
| `await login(query?)`          | HTTP          | Generates `state` / `nonce` / PKCE, then `driver.authorize`                                                                      |
| `await logout(query?)`         | HTTP          | `driver.logout` — returns `{ action: "redirect", url }` or `{ action: "local" }`                                                 |

⚠ **`ctx.auth` is VERBS ONLY.** Everything a handler could want to _know_ about auth — the issuer, the client id, what the driver can serve, what is cached — is a noun, and nouns live on [`ctx.state.app.config.auth`](#app-config).

There is **no** `ctx.auth.token(grant)`. A generic "call the token endpoint with anything" makes the driver contract unenforceable, since a consumer could drive any grant straight past it; `conduitClientCredentialsMiddleware` covers raw client-credentials.

The discovery-backed drivers read their endpoints off the upstream IdP's document, fetched by `amphora.idp`. Six fields are used, by their RFC wire names — only the first two are required by the specs, and a real IdP does omit the rest (Auth0 publishes no `introspection_endpoint`). ⚠ The **issuer** is not one of them: it is whatever amphora resolved for the idp, which already prefers the document's own `issuer` over the declared one (a tenant-scoped provider templates it in the metadata it serves). Amphora files the fetched keys under that same string, so re-deriving it in the driver could only disagree with where the keys live. There is likewise no `jwks_uri` on the driver surface — amphora fetches and caches the keys, and a member pylon reads nowhere would only look like it configured verification.

| Wire name                               | Spec level                                | Pylon behaviour when absent                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorization_endpoint`                | REQUIRED (OIDC Discovery §3, RFC 8414 §2) | `openid_configuration_incomplete` — thrown when the document is adopted                                                                                                               |
| `token_endpoint`                        | REQUIRED (OIDC Discovery §3, RFC 8414 §2) | `openid_configuration_incomplete` — thrown when the document is adopted                                                                                                               |
| `userinfo_endpoint`                     | RECOMMENDED (OIDC Discovery §3)           | `idp_userinfo_endpoint_not_supported` — thrown by `ctx.auth.userinfo()` when it must call the IdP                                                                                     |
| `introspection_endpoint`                | OPTIONAL (RFC 8414 §2, RFC 7662)          | `idp_introspection_endpoint_not_supported` — thrown by `ctx.auth.introspect()` when it must call the IdP                                                                              |
| `end_session_endpoint`                  | OPTIONAL (OIDC RP-Initiated Logout 1.0)   | `OpenIdDriver` logs out LOCALLY — the session is dropped and the browser goes straight to its destination                                                                             |
| `token_endpoint_auth_methods_supported` | OPTIONAL (OIDC Discovery §3, RFC 8414 §2) | Falls back to the spec default `client_secret_basic`, or to the strongest method the driver can compose when it holds no secret — see [Client authentication](#client-authentication) |

The named errors are thrown at the point of use, so the local fast paths still work: `ctx.auth.userinfo()` and `ctx.auth.introspect()` only throw when they actually have to reach the IdP, and the login callback's best-effort subject lookup stays silent. An IdP that serves an endpoint without advertising it can have the field supplied through the `idp.openIdConfiguration` override on the Amphora, which is merged over the fetched document.

## Sessions

`ctx.session` is an auth-focused store keyed by `id`, `accessToken`, `idToken?`, `refreshToken?`, `subject`, and `scope`. It is populated by Pylon's OIDC flow but the same shape works for any OAuth2 provider. It is **not** a general-purpose state bag — for anonymous data, use `ctx.cookies` directly or model the data as a domain entity.

The session lives under `auth`, next to the flow that fills it — `Session` is eight fields (`id`, `accessToken`, `expiresAt`, `idToken?`, `issuedAt`, `refreshToken?`, `scope`, `subject`) and carries no consumer payload, so it is an OAuth artifact store and the cookie is only how it is addressed.

```typescript
const app = new Pylon({
  auth: {
    driver: new OpenIdDriver({
      /* … */
    }),
    session: {
      enabled: true,
      domain: ".example.com",
      sameSite: "lax",
      secure: true,
      priority: "high",
      // Optional flat key selectors — each role falls back to its `cookies` counterpart.
      encryption: { condition: { purpose: "session", publish: false } },
    },
  },
  // …
});

await ctx.session.set({ id, accessToken, subject, issuedAt, expiresAt, scope });
const session = await ctx.session.get();
await ctx.session.del();
await ctx.session.logout(subject);
```

`enabled` is the literal `true`, not a boolean: presence IS the intent, so omit the block to turn sessions off rather than declaring one that does nothing.

Four cookie attributes are deliberately not settings, because none of them is the deployment's to choose:

| Attribute  | Fixed to                  | Why                                                                                                                                                               |
| ---------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | `pylon_session`           | `pylon_login_session` / `pylon_logout_session` never were configurable either, and one settable name of three does not solve a two-pylons-on-one-domain collision |
| `httpOnly` | `true`                    | The cookie addresses an access token, an id token and a refresh token — `httpOnly: false` hands all three to any XSS                                              |
| `encoding` | `base64url`               | The value is a store id or a sealed blob, both pylon's own opaque handle                                                                                          |
| `expiry`   | the session's `expiresAt` | A separate max-age can only disagree with the record it addresses. `expiresAt: null` ⇒ no expiry attribute ⇒ a browser-session cookie                             |

The session cookie is **signed / sealed when a key is configured** for it — `auth.session.<role> ?? cookies.<role>` (see [Keys](#keys)). There is no separate `signed` / `encrypted` toggle: naming the key turns the role on. When `auth.session.enabled` is true, Pylon registers the `Session` entity on the `kv` source — never on `cache`, since evicting a session logs the user out. With no `kv` configured the session is cookie-only: the whole session object travels in the cookie.

## Webhooks

Pylon ships a `WebhookSubscription` entity, an Iris-backed dispatcher, and a `ctx.webhook(event, data)` helper. Enable with `webhook: { enabled: true }` and provide either inline `db` / `bus` or rely on the top-level integrations.

```typescript
const app = new Pylon({
  webhook: {
    enabled: true,
    // The at-rest KEK for a subscription's stored secrets (`clientSecret`,
    // `password`). Default `{ condition: { purpose: "pylon:kek" } }` —
    // override for a separate key.
    encryption: { condition: { purpose: "pylon:kek", publish: false } },
    maxErrors: 20,
  },
  // …
});

await ctx.webhook("user.created", { userId: "abc-123", email: "alice@example.com" });
```

| Auth method          | Subscription requires                                 |
| -------------------- | ----------------------------------------------------- |
| `none`               | nothing                                               |
| `auth_headers`       | `authHeaders` map                                     |
| `basic`              | `username`, `password`                                |
| `client_credentials` | `clientId`, `clientSecret`, `issuer` (and `tokenUri`) |

Each subscription tracks `errorCount`, `lastErrorAt`, and `suspendedAt`. After `maxErrors` consecutive failures (default 10) the subscription is auto-suspended and the request consumer skips it until `errorCount` and `suspendedAt` are cleared.

### The stored delivery secrets

A subscription's **`clientSecret`** and its basic-auth **`password`** are encrypted **at rest** by Proteus: both columns ship a bare `@Encrypted()` marker, and Pylon stages `webhook.encryption` (the KEK selector) onto them before the source sets up. A client **registers plaintext credentials** — Proteus seals them on write and decrypts them transparently on read.

`username` beside the password is **not** encrypted, and neither are `clientId`, `issuer` or `tokenUri`: at-rest encryption is reserved for reversible secrets, not for identifiers or delivery configuration.

**The secrets never travel the bus.** The request consumer selects matched subscriptions and publishes one `WebhookDispatch` carrying the subscription **id** only; the dispatch consumer reloads the row DB-locally (Proteus decrypts there) and fans out — so the broker only ever holds the id, never a credential.

`webhook.encryption` is the same `{ kryptos?, condition? }` descriptor as the [`keys`](#keys) roles, read here as an **encrypt** (KEK) selector for the at-rest columns:

- `condition` — which of the vault's keys seals the secrets. Default `{ purpose: "pylon:kek" }` — the same bootstrap KEK that seals stored private keys (the webhook key does not rotate). Override it for a separate blast radius.
- `kryptos` — a key supplied outright (e.g. an env-imported KEK).

The floor is Proteus's (`use: "enc"`, private half), so the KEK can never be a signing key. Leaving the markers unresolvable (no `webhook.encryption` **and** no `pylon:kek` key in the vault) throws `unnamed_encryption_key` at setup — the columns never silently store plaintext.

## Workers

Pass workers as `LindormWorker` instances, factory-built workers, or a directory string for file-based scanning. Pylon also runs a built-in `AmphoraWorker` on a 5-minute interval that calls `amphora.refresh()` to keep cached key material in sync — you do not need to add it.

```typescript
import { LindormWorker } from "@lindorm/worker";

const app = new Pylon({
  workers: [
    new LindormWorker({
      alias: "SyncInventory",
      interval: "5m",
      jitter: true,
      retry: { retries: 3, minTimeout: "1s" },
      logger,
      callback: async (ctx) => {
        await syncExternalInventory(ctx.logger);
      },
    }),
  ],
  // …
});
```

### Built-in worker factories

```typescript
import {
  createAmphoraEntityWorker,
  createCertificateExpiryWorker,
  createExpiryCleanupWorker,
  createKryptosRotationWorker,
} from "@lindorm/pylon";
```

| Factory                         | Default schedule  | Description                                                            |
| ------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| `createAmphoraEntityWorker`     | `3m` interval     | Loads `KryptosDB` entities from Proteus and feeds them into Amphora    |
| `createCertificateExpiryWorker` | `0 10 * * *` cron | Warns/errors as vault-key certificate chains approach expiry           |
| `createExpiryCleanupWorker`     | `15m` interval    | Calls `repository.deleteExpired()` for each entity in `targets`        |
| `createKryptosRotationWorker`   | `1d` interval     | Generates + rotates keys, publishing fresh ones to Amphora immediately |

`createCertificateExpiryWorker({ amphora, logger, warnThreshold?, errorThreshold?, cron?, timezone? })` runs daily (cron `0 10 * * *`, `UTC`) and inspects **every certificate** in **every** vault key's chain — leaf and issuing/root CAs alike (the long-lived CA certs are the real targets, and they are only reachable through the chains). A cert already expired or within `errorThreshold` (default `1mo`) logs `error`; within `warnThreshold` (default `3mo`) logs `warn`; otherwise it is silent. Certs are **deduped by `x5t#S256`** across the run — a shared CA cert produces one line, annotated with every referencing `kid` — and each run ends with one `verbose` summary (`checked / warn / error`).

`createKryptosRotationWorker` has **no default key set**. It mints exactly the keys you give it — pass none and it rotates nothing (and warns at startup). The key set is your deployment's, not Pylon's: see [Keys](#keys). `@lindorm/create-pylon` scaffolds a complete, working set into the generated app as editable source.

The persisted `Kryptos.privateKey` is encrypted **at rest** by Proteus, sealed under the KEK named by `kryptos.encryption` (default `{ condition: { purpose: "pylon:kek" } }`) — staged onto the entity's bare `@Encrypted()` marker before the source sets up. As with webhooks, an unresolvable KEK throws `unnamed_encryption_key` at setup rather than storing key material in the clear.

```typescript
createKryptosRotationWorker({
  amphora,
  logger,
  db,
  keys: [
    { algorithm: "dir", publish: false, purpose: "cookie", expiry: "1y" },
    { algorithm: "HS256", publish: false, purpose: "cookie", expiry: "1y" },
    {
      algorithm: "EdDSA",
      curve: "Ed448",
      publish: false,
      purpose: "session",
      expiry: "1y",
    },
    {
      algorithm: "ECDH-ES",
      curve: "X448",
      publish: false,
      purpose: "session",
      expiry: "1y",
    },
    {
      algorithm: "EdDSA",
      curve: "Ed25519",
      publish: true,
      purpose: "token",
      expiry: "6mo",
    },
    {
      // A PUBLISHED key must be one a relying party can actually import.
      // `ECDH-ES+A*GCMKW` is not a registered JWE algorithm — RFC 7518 §4.6
      // defines `ECDH-ES` and the three `+A*KW` forms only — so `jose`, and
      // every RP built on it, rejects it on the `alg` value alone.
      algorithm: "ECDH-ES+A256KW",
      curve: "X448",
      publish: true,
      purpose: "token",
      expiry: "6mo",
    },
  ],
});
```

- **`publish: false`** keys stay in the vault for internal use (cookie/session crypto) and are **excluded from the JWKS** — and, since Amphora's `find`/`filter` default to `{ publish: true }`, from ordinary key selection too. To select an internal key you must ask for it: `{ publish: false, … }`. `findById` is unfiltered — an explicit kid is explicit intent.
- ⚠ **`publish` defaults to `false`** (the Kryptos default: a minted key is unpublished until you say otherwise). **Every key you want in the JWKS must say `publish: true`** — a key set that omits it produces an **empty JWKS**, and no relying party can verify anything. State `publish` on every key.
- **Per-key `expiry`** — rotation overlap is half each key's own expiry. The unit for months is `mo`/`month`; `m` means **minutes**. Unset keys fall back to the worker-level `expiry` (default `6mo`).
- Pass **`amphora`** so freshly-minted keys are added to the vault at rotation time — JWKS is populated on first boot instead of after the next `createAmphoraEntityWorker` tick (that worker is for picking up _other_ instances' keys). Pass **`rootCaKey`** to CA-sign the published, asymmetric keys (an internal key gets no chain — it has no relying party to convince).

`createKryptosRotationWorker` and `createAmphoraEntityWorker` use Pylon's built-in `Kryptos` entity by default; pass `target` to override with a custom `KryptosDB` implementation.

## Keys

Pylon resolves a vault key for signing a cookie, verifying one, and encrypting a cookie value or a stored session's tokens. It holds **no opinion about which key that should be**: it does not know your `purpose` taxonomy and will not invent one. **The deployment says which key does what** — each feature declares its own **flat** key selectors, and **a configured key turns that role on by default**:

```typescript
const app = new Pylon({
  cookies: {
    signature: { condition: { purpose: "cookie", publish: false } },
    encryption: { condition: { purpose: "cookie", publish: false } },
  },
  // Optional — every role falls back to its `cookies` counterpart.
  auth: {
    driver,
    session: {
      enabled: true,
      signature: { condition: { purpose: "session", publish: false } },
      encryption: { condition: { purpose: "session", publish: false } },
    },
  },
  // …
});
```

**Settings declare the keys; the runtime toggles them.** A configured `cookies.signature` means a plain `ctx.cookies.set(name, value)` is signed and the matching `get` verified — no per-call option. A per-call `ctx.cookies.set(name, value, { signature: false })` opts THAT cookie out; a selector (`{ signature: mySelector }`) names its own key. The declaration is a pure selector; only the runtime `set` / `get` fields are `boolean | selector`.

This is the same `{ kryptos?, condition? }` descriptor used across the toolkit (`@lindorm/aegis`, `@lindorm/proteus`, `@lindorm/iris`): `kryptos` is a key supplied outright, `condition` is which of the vault's keys.

| Role         | Kind     | Floor Pylon owns                             | On when                            |
| ------------ | -------- | -------------------------------------------- | ---------------------------------- |
| `signature`  | selector | `use: "sig"`, private half, `isActive: true` | named — else cookies are unsigned  |
| `encryption` | selector | `use: "enc"`, private half, not pending      | named — else cookies are plaintext |

Verification has **no selector**: it is derived from the resolved `signature`'s condition (see below), checked with the floor `use: "sig"`, `isPending: false`.

### A session IS a cookie

There is no separate session key taxonomy, because there is no separate artifact. With a session store the cookie carries the session id and the tokens are sealed **at rest**; without one the **whole session object — tokens and all — travels in the cookie**. Either way it is a cookie, so each `session` selector is a per-role override of its `cookies` counterpart:

```
auth.session.<role> ?? cookies.<role>
```

Name only `cookies` and one key set does everything. Name `auth.session` too and the session cookie is signed / sealed with its **own** key — a smaller blast radius, or an asymmetric signature for session cookies specifically — while every ordinary cookie keeps using the `cookies` keys. Any cookie can do the same, per call — `signature` and `encryption` each take `true` (the deployment cookie key) or a selector (its own key): `ctx.cookies.set(name, value, { signature, encryption: true })`.

### Verification is derived from `signature`

Verification asks: _is the key that signed this cookie one of the keys I would have signed it with?_ That **is** the signing policy — so the verification condition is the resolved `signature`'s condition:

```
{ condition: (auth.session.signature ?? cookies.signature).condition }
```

Naming `auth.session.signature` is therefore **enough**; there is no separate verification field to declare or forget, and no way to configure a session cookie that signs but cannot be read. When a `signature` is an injected `kryptos` there is no condition to inherit and the floor (`use: "sig"`) applies alone: the cookie's `.kid` already names the key. For a genuinely broader read policy on one read, pass a `PylonVerifyKey` to the per-call `ctx.cookies.get(name, { signed })`.

### Rollover

- **Key rotation never invalidates a live cookie.** A signature is verified against the key the cookie's own `.kid` names, and the condition matches a key _class_, not a kid — so when the rotation worker mints next year's cookie key, cookies signed by the previous one keep verifying. That is why the verification floor is `isPending: false` and **not** `isActive`: an **expired** key must keep verifying, or a rotation would log out every live session. A key whose `notBefore` has not passed cannot have signed anything, so it is refused — the `.kid` is the client's claim, and it does not get to name a key that has never been usable. Ciphertext likewise names its own key, so it keeps decrypting.
- **Changing the signing _policy_ is different.** Introducing `auth.session.signature: { purpose: "session" }` narrows the derived read policy to session keys, which excludes the cookie key your live session cookies were signed with — those cookies stop verifying on the next read. Plan the cutover as a rotation: keep signing with the cookie key until live sessions have expired, then introduce the session signing key.

### The rest

- ⚠ **`publish: false` is load-bearing.** Amphora's default query is the **published** set, so an internal cookie/session key is unreachable without it. Omit it and you select the JWKS token key.
- **A cookie is signed only when a signing key is named.** There is no fallback to the floor alone — it would resolve to whichever published key is newest, in practice the token key (token keys rotate twice as often as cookie keys). So no `cookies.signature` ⇒ unsigned cookies; a per-call `{ signature: true }` with none configured throws rather than guessing. Since `auth.session` chains to `cookies`, a session cookie is signable iff a cookie signing key is named.
- **The floor is Pylon's, the selector is yours.** `use`, `hasPrivateKey` and the key's lifetime state are the minimum that makes an operation possible; they are absent from the condition type by construction, so you cannot widen them. `purpose`, `publish` and `internal` are your policy.
- **Signing demands an active key.** `isActive: true` is on the signing floor, so an expired or not-yet-valid key never signs a cookie — including one handed to `cookies.signature` as an injected `kryptos`, which never touches the vault and is therefore time-checked by nothing else.
- **The read side of encryption takes no selector.** Ciphertext names its own key, so `aes.decrypt` resolves it by kid.
- A role naming a key the vault does not hold **fails loudly**, never silently.

## Health & readiness

Two probes are always auto-mounted:

- **`GET /health` — liveness.** Verifies the durable I/O (`db`/`bus`) **once**, then latches success and returns `204` on every later call **without re-pinging**. The process proves it came up (I/O reachable once), but a later DB/broker blip never flips liveness — restarting the container can't fix the DB, it only thrashes. Until the first successful check it returns `503`. It deliberately does **not** cover `kv`/`cache`: readiness already drains a pod whose ephemeral store is unreachable, and restarting cannot fix that either.
- **`GET /ready` — readiness.** Pings **every configured source** — `db`, `kv`, `cache`, `bus` — on **every** call, reflecting current state, for load-balancer / readiness probes. Roles the deployment did not configure are simply absent, not a failure. Returns `204` when healthy (or when there's no I/O to check) and `503 Service Unavailable` with `code: "health_check_failed"` + `data.failures` (the role names) when a source is down. `kv` and `cache` are in there because they can be separately deployed instances: without them a pod whose session store is unreachable reports green and every login on it fails. When `cache` falls back to `kv` the shared instance is pinged **once**, reported under `kv`.

Override or disable either via `callbacks` (`null` = a pure `204` probe, no check):

```typescript
const app = new Pylon({
  callbacks: {
    // custom liveness check (rarely needed — keep it dependency-free)
    health: async (ctx) => {
      await checkSelf();
    },
    // custom readiness check
    ready: async (ctx) => {
      await checkDownstream();
    },
  },
  // …
});

// Pure 204 probes, no checks at all
const app2 = new Pylon({
  callbacks: { health: null, ready: null },
  // …
});
```

## Well-known endpoints

Mounted under `/.well-known`:

| Route                           | Description                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /jwks.json`                | The published JWKS, served straight from the Amphora                                                                                                                     |
| `GET /oauth-protected-resource` | RFC 9728 protected resource metadata: `{ resource: <domain>, authorization_servers: [<driver issuer>] }`. Requires `domain` and an `auth` driver that resolves an issuer |
| `GET /right-to-be-forgotten`    | Bearer-authorized erasure hook — invokes `callbacks.rightToBeForgotten`, returns `204`                                                                                   |
| `GET /change-password`          | Redirects to `changePasswordUri`                                                                                                                                         |
| `GET /security.txt`             | Opt-in — rendered from `securityTxt`                                                                                                                                     |

Pylon does **not** serve a discovery document. A discovery document is derived from what a service actually implements — its policy registry, its served keys, its implemented grants — so an authorization server owns and mounts its own `/.well-known` router:

```typescript
import { Pylon, PylonRouter } from "@lindorm/pylon";

const wellKnown = new PylonRouter();

wellKnown.get("/openid-configuration", async (ctx) => {
  ctx.body = buildDiscoveryDocument(ctx);
  ctx.status = 200;
});

const app = new Pylon({
  routes: [{ path: "/.well-known", router: wellKnown }],
  // …
});
```

Explicit routers fall through cleanly alongside pylon's own well-known routes.

## Logging & redaction

Pylon redacts credentials before they reach a log. The live header object is never mutated — logging gets a redacted copy.

| Header                           | Logged as                                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| `authorization: Bearer` / `DPoP` | `Bearer header.payload` — the signature is dropped                 |
| `authorization: Basic`           | `Basic <username>:[Filtered]` — the password never appears         |
| `dpop`                           | `header.payload` — the proof's claims stay, its signature does not |
| `cookie` / `set-cookie`          | names and attributes kept, every value `[Filtered]`                |

Tokens pylon's own middleware handles are logged signature-stripped, and cookie values are filtered wherever pylon logs them. Everything else — including request and response **bodies** — is logged as-is: pylon is transport, and body contents are the application's to redact.

## Error handling

Raise errors with `@lindorm/errors` — not koa's `ctx.throw`, which is intentionally removed from the typed HTTP context. Throw any `LindormError` (or subclass — `ClientError`, `ServerError`, `PylonError`, the status-coded HTTP classes `BadRequestError` / `NotFoundError` / `ConflictError` / …) from a handler or middleware. Pass `code`, `data`, `details`, and `title` to enrich the response.

```typescript
import { NotFoundError } from "@lindorm/errors";
import { useHandler } from "@lindorm/pylon";

router.get(
  "/songs/:id",
  useHandler(async (ctx) => {
    const song = await ctx.db.repository(Song).findOne({ id: ctx.params.id });

    if (!song) {
      throw new NotFoundError(`No song "${ctx.params.id}"`, {
        code: "song_not_found",
        data: { id: ctx.params.id },
      });
    }

    return { body: song };
  }),
);
```

Pylon catches the throw in the built-in `httpErrorHandlerMiddleware`, derives the HTTP status from the error (`status` → `statusCode` → `500`), and converts it into a JSON response:

```json
{
  "__meta": {
    "app": "Pylon",
    "environment": "production",
    "name": "my-service",
    "version": "1.2.3"
  },
  "error": {
    "id": "<uuid>",
    "name": "ClientError",
    "title": "Error",
    "message": "User not found",
    "code": "unknown_error",
    "support": "<random>",
    "data": {}
  }
}
```

Throwing a `RedirectError` instead emits a redirect with `error` (`code`), `error_description` (the error's `details`), `error_uri` (`uri`), `support`, `state`, and `iss` (the `issuer` prop; RFC 9207) query parameters appended to its `redirect` URL. `error_description`, `error_uri`, `state`, and `iss` are only emitted when the error carries them.

### Authentication challenges

`ctx.challenge(scheme, params?)` appends a `WWW-Authenticate` challenge to the response. Each call appends — one 401 may advertise several challenges (RFC 9110 §11.6.1), which is how an endpoint says "Basic **or** Bearer". Params are typed per scheme: `basic` (RFC 7617) takes `realm` / `charset` and deliberately has no error param; `bearer` (RFC 6750) takes `realm` / `error` / `errorDescription` / `scope`; `dpop` (RFC 9449) adds `algs` and `nonce` — the nonce is emitted as a `DPoP-Nonce` header, never as an auth-param.

```typescript
ctx.challenge("bearer", {
  realm: "api.example.com",
  error: "insufficient_scope",
  scope: "songs:write",
});
ctx.challenge("dpop", {
  realm: "api.example.com",
  error: "use_dpop_nonce",
  algs: ["ES256"],
  nonce,
});
```

When a request ends in a **401 without any challenge**, the error handler derives one from the scheme the client actually attempted (`ctx.state.authorization.type`): `Basic realm="<domain>"`, or `Bearer` / `DPoP` with `error="invalid_token"`, realm from `app.domain`. If the client attempted no scheme (`type: "none"`) Pylon emits nothing — it does not invent a scheme the client never tried — and logs a warning instead; call `ctx.challenge()` to advertise what the endpoint accepts. Only 401 is derived: a 403 `insufficient_scope` challenge is a deliberate `ctx.challenge()` call.

| Error class                      | Description                                    |
| -------------------------------- | ---------------------------------------------- |
| `PylonError`                     | Base framework error (extends `LindormError`)  |
| `RedirectError`                  | Redirect with state and error metadata         |
| `CorsError`                      | CORS policy violation (extends `ClientError`)  |
| `CannotEstablishSessionIdentity` | Thrown when no source yields a session subject |
| `IntrospectionEndpointFailed`    | Surface for IdP introspection failures         |
| `UserinfoEndpointFailed`         | Surface for IdP userinfo failures              |

## CORS

```typescript
const app = new Pylon({
  cors: {
    allowOrigins: ["https://example.com", "https://app.example.com"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Authorization", "Content-Type"],
    allowCredentials: true,
    exposeHeaders: ["X-Request-Id"],
    maxAge: "1h",
    embedderPolicy: "require-corp",
    openerPolicy: "same-origin",
    privateNetworkAccess: true,
  },
  // …
});
```

Use `"*"` for `allowOrigins`, `allowMethods`, or `allowHeaders` to allow everything. When socket and session are both enabled, Pylon refuses to start unless `cors.allowOrigins` is an explicit array (the wildcard would expose the session to Cross-Site WebSocket Hijacking).

## Body parsing

```typescript
const app = new Pylon({
  parseBody: {
    limits: {
      json: "5Mb",
      form: "100Kb",
      text: "1Kb",
    },
    multipart: true,
    formidable: true,
    formidableOptions: { maxFileSize: 50 * 1024 * 1024 },
    methods: ["POST", "PUT", "PATCH"],
  },
  // …
});
```

The parsed body is exposed as `ctx.data` (camelCased). The raw parsed body is also available on `ctx.request.body`, and multipart uploads land on `ctx.request.files` as a formidable `Files` map.

## Type-safe socket emissions

`Pylon` accepts a `PylonEventMap` generic that types every `ctx.socket.emit` call:

```typescript
import { Pylon, PylonEventMap } from "@lindorm/pylon";

type Events = {
  "mfa:challenge": { challengeId: string; device: string; ip: string };
  "chat:message": { text: string; sender: string };
};

const app = new Pylon<Events>({
  // …
});

ctx.socket?.emit("user:abc", "mfa:challenge", { challengeId, device, ip }); // ok
ctx.socket?.emit("user:abc", "mfa:challenge", { wrong: "shape" }); // type error
```

The map types only outgoing emissions; incoming listener payloads are typed by the handler signature.

## Entities

The package re-exports three Proteus entities for the framework's built-in features:

| Entity                | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `DataAuditLog`        | Field-level diff records produced by entity audit |
| `RequestAuditLog`     | Stored request audit records                      |
| `WebhookSubscription` | Webhook targets and their authentication settings |

```typescript
import { DataAuditLog, RequestAuditLog, WebhookSubscription } from "@lindorm/pylon";
```

The remaining entities (`Session`, `Kryptos`, `Presence`, `CachedResponse`, `CachedIntrospection`, `CachedUserinfo`, rate-limit entities) are wired into the source their role dictates automatically when their feature is enabled — see [Source roles](#source-roles) — and are not part of the public import surface. `ConduitCachedResponse` is the exception: it is **consumer-placed**, registered on whichever source you hand `createProteusCacheDriver`, never by Pylon.

## Command-line tools

`@lindorm/pylon` ships a `pylon` binary for scaffolding new files. Run it via `npx pylon` or `./node_modules/.bin/pylon`. All `generate` commands prompt interactively when arguments are omitted and support `--dry-run` to print the generated file instead of writing it.

```bash
pylon --help
pylon generate --help
```

| Command                                                                                   | Output                                                                        |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pylon generate route GET,POST /v1/users/:id`                                             | `./src/routes/v1/users/[id].ts`                                               |
| `pylon generate route --feature user --methods get,post,put,delete --path /v1/users/[id]` | per-method `./src/features/user/*.ts` + wired `./src/routes/v1/users/[id].ts` |
| `pylon generate listener ON chat:message`                                                 | `./src/listeners/chat/message.ts`                                             |
| `pylon generate middleware /v1/admin`                                                     | `./src/routes/v1/admin/_middleware.ts`                                        |
| `pylon generate middleware -S chat`                                                       | `./src/listeners/chat/_middleware.ts`                                         |
| `pylon generate handler getUser`                                                          | `./src/handlers/getUser.ts`                                                   |
| `pylon generate worker HeartbeatWorker`                                                   | `./src/workers/heartbeat-worker.ts` (INTERVAL)                                |
| `pylon generate worker CleanupWorker --cron "0 3 * * *"`                                  | `./src/workers/cleanup-worker.ts` (CRON)                                      |
| `pylon generate static /assets`                                                           | `./src/routes/assets.ts` (STATIC)                                             |
| `pylon generate upload /assets`                                                           | `./src/routes/assets.ts` (UPLOAD)                                             |

Each command accepts `-d, --directory <path>` to override the output directory and `--dry-run` to skip writing. When `--directory` is omitted, the output directory resolves from `lindorm.config.{ts,mjs}` (`pylon.routesDir` / `handlersDir` / `listenersDir` / `workersDir`) and falls back to the built-in default — see `@lindorm/scaffold`.

`generate route --feature <name>` scaffolds a full slice instead of a bare route: one schema+handler file per HTTP method in the feature dir, named `<verb><Feature><RouteTail>` — the route tail is the last static path segment plus trailing params as `By<Param>`, so sibling routes within one feature never collide (`--feature user --path /v1/users/[id]` → `getUserUsersById`/`getUserUsersByIdSchema`, `createUserUsersById`/…; `--feature oauth --path /token` → `createOauthToken`) — plus a route file that wires each method as `[useSchema(...), useHandler(...)]`. The feature dir resolves from `pylon.featureDir` (default `./src/features`), the route dir from `pylon.routesDir`; both context-type and handler imports are computed relative to the standard `src/{routes,features,types}` layout. Use `-m/--methods` / `-p/--path` as flag alternatives to the positional args.

`generate worker` scaffolds an interval worker (`export const INTERVAL = "5m"`) by default. Pass `--cron <expression>` to emit `export const CRON = "<expression>"` instead — never both, since the worker scanner requires exactly one of the two. The expression is validated before anything is written, so an invalid cron fails the command (also under `--dry-run`).

`pylon config init` writes a default `lindorm.config.ts` (built from `@lindorm/scaffold`'s `defineConfig`) into the current directory. It refuses to overwrite an existing file unless `-f, --force` is passed, and `--dry-run` prints the path and content without writing.

The generators behind the CLI are also available programmatically on the `@lindorm/pylon/scaffold` subpath, kept off the runtime surface so scaffold tooling never pulls the server runtime into scope:

```typescript
import {
  generateRoute,
  generateRouteFeature,
  generateHandler,
  generateListener,
  generateMiddleware,
  generateWorker,
  generateStatic,
  generateUpload,
} from "@lindorm/pylon/scaffold";

await generateRoute("GET,POST", "/v1/users/:id", { directory: "./src/routes" });
await generateHandler("getUser", { directory: "./src/handlers" });
```

## License

AGPL-3.0-or-later.
