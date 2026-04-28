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
const amphora = new Amphora({ domain: "https://api.example.com", logger });

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
- Auto-mounted endpoints for `/health`, `/.well-known/jwks.json`, `/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/right-to-be-forgotten`, `/.well-known/change-password`, and (opt-in) `/.well-known/security.txt`

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

  proteus: proteusSource,
  iris: irisSource,

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

ctx.proteus?;    // IProteusSession when configured
ctx.iris?;       // IIrisSession when configured
ctx.hermes?;     // IHermesSession when configured

ctx.publishers?;    // populated by createPublisherMiddleware
ctx.workerQueues?;  // populated by createWorkerQueueMiddleware

ctx.queue(event, payload, priority?, optional?);  // enqueue a Job (when queue.enabled)
ctx.webhook(event, data?, optional?);             // dispatch a webhook (when webhook.enabled)

ctx.state.app;            // { domain, environment, name, version }
ctx.state.actor;          // resolved actor string
ctx.state.authorization;  // { type: "basic" | "bearer" | "dpop" | "none", value }
ctx.state.metadata;       // { id, correlationId, date, environment, ... }
ctx.state.tenant?;        // tenant id when useTenant() ran
ctx.state.tokens;         // map of parsed tokens (accessToken, idToken, ...)
```

HTTP-only additions:

```typescript
ctx.auth;       // full PylonAuthClient (login / logout / token in addition to claims)
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

Recognised exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. Alternatively, default-export or name-export a `PylonRouter` instance for full control.

### Middleware inheritance

A `_middleware.ts` file at any directory level exports a `MIDDLEWARE` constant (single middleware or an array). Middleware is composed top-down: a handler at `routes/v1/users/[id].ts` runs root middleware first, then `v1` middleware, then any handler-local middleware, then the handler itself.

```typescript
// routes/_middleware.ts
export const MIDDLEWARE = [corsMiddleware, requestLoggingMiddleware];

// routes/v1/_middleware.ts
export const MIDDLEWARE = [bearerAuth];
```

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
import { Pylon, createHandshakeTokenMiddleware } from "@lindorm/pylon";

const app = new Pylon({
  socket: {
    enabled: true,
    listeners: "./src/listeners",
    connectionMiddleware: [
      createHandshakeTokenMiddleware({ issuer: "https://auth.example.com" }),
    ],
  },
  // …
});
```

### Auth refresh protocol

When `createHandshakeTokenMiddleware` (or the auto-wired session connection middleware) populates auth state at handshake time, Pylon registers a refresh listener for the reserved events:

| Event                 | Direction       | Purpose                                                          |
| --------------------- | --------------- | ---------------------------------------------------------------- |
| `$pylon/auth/refresh` | client → server | Replace bearer / re-read session and refresh expiry              |
| `$pylon/auth/expired` | server → client | Advisory event emitted once inside the pre-expiry warning window |

After the handshake, `createAccessTokenMiddleware` does not re-verify the token on every event. It checks the expiry on the stored auth state — accepted silently if well before expiry, accepted with one `$pylon/auth/expired` emission inside the warning window, and rejected (with the socket disconnected for session strategy) once expired.

### Rooms

Enable with the `rooms` option on the constructor:

```typescript
const app = new Pylon({
  rooms: { presence: true },
  proteus: proteusSource,
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

`presence` requires `rooms.presence: true` and a Proteus source — Pylon registers a `Presence` entity at startup and writes a record on each `join`.

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
  createAccessTokenMiddleware,
  createBasicAuthMiddleware,
  createHandshakeTokenMiddleware,
  createTokenMiddleware,
} from "@lindorm/pylon";

const accessAuth = createAccessTokenMiddleware({
  issuer: "https://auth.example.com",
  audience: "my-api",
});

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

`createAccessTokenMiddleware` works on both HTTP and socket-event contexts: on HTTP it verifies the bearer / DPoP / session-derived access token; on socket events it consults the auth state established by `createHandshakeTokenMiddleware` instead of re-verifying every event.

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

`useRoles` and `usePermissions` accept a trailing `{ token: "<key>" }` to read from a non-default token (default: `accessToken`). `useAccess` reads claims from the OIDC introspection result when checking against `accessToken`, and from the parsed token payload otherwise.

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
router.use(useTenant("state.tokens.apiKey.payload.tenantId", { required: true }));

// Apply a Proteus filter on every query in the request
router.use(useScope({ params: (ctx) => ({ tenantId: ctx.state.tenant }) }));
```

`useTenant` defaults to `required: true`, sets `ctx.state.tenant`, and (when a tenant is found and a Proteus session exists) installs a `__scope` filter param.

### Rate limiting

```typescript
import { useRateLimit } from "@lindorm/pylon";

router.use(useRateLimit({ window: "1m", max: 60 })); // fixed (default)
router.use(useRateLimit({ window: "1m", max: 60, strategy: "sliding" }));
router.use(useRateLimit({ window: "1m", max: 60, strategy: "token-bucket" }));

router.use(
  useRateLimit({
    window: "15m",
    max: 100,
    key: (ctx) => ctx.state.tokens.accessToken?.payload.subject ?? "anon",
    skip: (ctx) => false,
  }),
);
```

`useRateLimit` requires `rateLimit: { enabled: true }` on the constructor (which also wires the entities into the Proteus source). HTTP responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-RateLimit-Strategy`; rejected requests also include `Retry-After`.

When `rateLimit.window` and `rateLimit.max` are set on the constructor, Pylon installs a global rate-limit middleware automatically.

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

`useAuditLog` requires `audit: { enabled: true }` on the constructor and an Iris source (either `audit.iris` or `iris`). Each request publishes a `RequestAudit` message containing the endpoint, method, transport, status, duration, source IP, session id, user agent, request id, correlation id, actor, and the (optionally sanitised) body. Set `audit.entities` to a list of entity classes for entity-level change tracking — Pylon installs Proteus listeners on those entities and persists field-level diffs into `DataAuditLog`.

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

Pylon can act as an OpenID Connect Relying Party. Set `auth` to enable token verification and (unless `auth.router` is set to `null` via the partial) auto-mounted endpoints under `pathPrefix`.

```typescript
const app = new Pylon({
  auth: {
    clientId: "my-client-id",
    clientSecret: "my-client-secret",
    issuer: "https://auth.example.com",
    refresh: { mode: "half_life" },
    router: {
      pathPrefix: "/auth",
      errorRedirect: "/error",
      authorize: {
        scope: ["openid", "profile", "email"],
        responseType: "code",
        codeChallengeMethod: "S256",
      },
    },
  },
  session: { enabled: true },
  // …
});
```

| Refresh mode | Behaviour                                                           |
| ------------ | ------------------------------------------------------------------- |
| `force`      | Refresh on every request that goes through the refresh middleware   |
| `half_life`  | Refresh once the request crosses the half-life of the current token |
| `max_age`    | Refresh after `refresh.maxAge` since `issuedAt`                     |
| `none`       | Never auto-refresh                                                  |

| Route                              | Description                                                            |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `GET /:prefix/login`               | Start the authorize flow — sets the login cookie, redirects to the IdP |
| `GET /:prefix/login/callback`      | Handle the authorize callback, exchange the code, set the session      |
| `GET /:prefix/logout`              | Start RP-initiated logout                                              |
| `GET /:prefix/logout/callback`     | Handle the IdP's post-logout redirect                                  |
| `POST /:prefix/backchannel-logout` | Handle RP-initiated backchannel logout                                 |
| `GET /:prefix/refresh`             | Force-refresh the session's tokens                                     |
| `GET /:prefix/userinfo`            | Return `ctx.auth.userinfo()` (id-token fast path with IdP fallback)    |
| `GET /:prefix/introspect`          | Return `ctx.auth.introspect()` (RFC 7662 metadata)                     |
| `GET /:prefix/error`               | OIDC error landing page                                                |

`ctx.auth.userinfo()` answers _who is this user?_ — it parses the id token locally when possible and falls back to the IdP's userinfo endpoint. `ctx.auth.introspect()` answers _is this token valid, what can it do, when does it expire?_.

## Sessions

`ctx.session` is an auth-focused store keyed by `id`, `accessToken`, `idToken?`, `refreshToken?`, `subject`, and `scope`. It is populated by Pylon's OIDC flow but the same shape works for any OAuth2 provider. It is **not** a general-purpose state bag — for anonymous data, use `ctx.cookies` directly or model the data as a domain entity.

```typescript
const app = new Pylon({
  session: {
    enabled: true,
    name: "sid",
    domain: ".example.com",
    encrypted: true,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    expiry: "7d",
    priority: "high",
  },
  // …
});

await ctx.session.set({ id, accessToken, subject, issuedAt, expiresAt, scope });
const session = await ctx.session.get();
await ctx.session.del();
await ctx.session.logout(subject);
```

When `session.enabled` is true, Pylon registers the `Session` entity on the configured Proteus source.

## Webhooks

Pylon ships a `WebhookSubscription` entity, an Iris-backed dispatcher, and a `ctx.webhook(event, data)` helper. Enable with `webhook: { enabled: true }` and provide either inline `proteus` / `iris` or rely on the top-level integrations.

```typescript
const app = new Pylon({
  webhook: {
    enabled: true,
    encryptionKey: myKryptos,
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
  createExpiryCleanupWorker,
  createKryptosRotationWorker,
} from "@lindorm/pylon";
```

| Factory                       | Default interval | Description                                                            |
| ----------------------------- | ---------------- | ---------------------------------------------------------------------- |
| `createAmphoraEntityWorker`   | `3m`             | Loads `KryptosDB` entities from Proteus and feeds them into Amphora    |
| `createExpiryCleanupWorker`   | `15m`            | Calls `repository.deleteExpired()` for each entity in `targets`        |
| `createKryptosRotationWorker` | `1d`             | Generates and rotates cryptographic keys with a default 6-month expiry |

`createKryptosRotationWorker` defaults to the following key set (override `keys` to change the token set):

| Algorithm           | Curve     | Purpose | Hidden |
| ------------------- | --------- | ------- | ------ |
| `dir`               | —         | cookie  | yes    |
| `HS256`             | —         | cookie  | yes    |
| `EdDSA`             | `Ed448`   | session | yes    |
| `ECDH-ES`           | `X448`    | session | yes    |
| `EdDSA`             | `Ed25519` | token   | no     |
| `ECDH-ES+A256GCMKW` | `X448`    | token   | no     |

`createKryptosRotationWorker` and `createAmphoraEntityWorker` use Pylon's built-in `Kryptos` entity by default; pass `target` to override with a custom `KryptosDB` implementation.

## Health check

`GET /health` is auto-mounted. With no `callbacks.health`, Pylon builds a default callback based on the integrations you configured:

- If `proteus` is configured, the callback pings it.
- If `iris` is configured, the callback pings it.
- On failure, the response is `503 Service Unavailable` with `code: "health_check_failed"` and `data.failures` listing which integrations failed.
- Otherwise (or when neither integration is configured) the endpoint returns `204 No Content`.

```typescript
const app = new Pylon({
  callbacks: {
    health: async (ctx) => {
      await checkDownstream();
    },
  },
  // …
});

// Disable the default — /health returns 204 unconditionally
const app2 = new Pylon({
  callbacks: { health: null },
  // …
});
```

## Error handling

Throw any `LindormError` (or subclass — `ClientError`, `ServerError`, `PylonError`, …) from a handler or middleware. Pylon converts it into a JSON response:

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

Throwing a `RedirectError` instead emits a redirect with `error`, `error_uri`, `support`, and `state` query parameters appended to its `redirect` URL.

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

The remaining entities (`Session`, `Kryptos`, `Presence`, rate-limit entities) are wired into the configured Proteus source automatically when their feature is enabled — they are not part of the public import surface.

## Command-line tools

`@lindorm/pylon` ships a `pylon` binary for scaffolding new files. Run it via `npx pylon` or `./node_modules/.bin/pylon`. All `generate` commands prompt interactively when arguments are omitted and support `--dry-run` to print the generated file instead of writing it.

```bash
pylon --help
pylon generate --help
```

| Command                                       | Output                                 |
| --------------------------------------------- | -------------------------------------- |
| `pylon generate route GET,POST /v1/users/:id` | `./src/routes/v1/users/[id].ts`        |
| `pylon generate listener ON chat:message`     | `./src/listeners/chat/message.ts`      |
| `pylon generate middleware /v1/admin`         | `./src/routes/v1/admin/_middleware.ts` |
| `pylon generate middleware -S chat`           | `./src/listeners/chat/_middleware.ts`  |
| `pylon generate handler getUser`              | `./src/handlers/getUser.ts`            |
| `pylon generate worker HeartbeatWorker`       | `./src/workers/heartbeat-worker.ts`    |

Each command accepts `-d, --directory <path>` to override the output directory and `--dry-run` to skip writing.

## License

AGPL-3.0-or-later.
