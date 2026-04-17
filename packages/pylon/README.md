# @lindorm/pylon

Full-stack **HTTP + WebSocket application framework** for Node.js with strict typing, modularity, and security built in. It builds on [Koa](https://koajs.com/) (HTTP) and [Socket.io](https://socket.io/) but hides the boilerplate behind a cohesive, testable API that integrates with the Lindorm ecosystem.

## Installation

```bash
npm install @lindorm/pylon
```

Peer dependencies vary by feature:

| Feature     | Peer Dependency    | Required When                           |
| ----------- | ------------------ | --------------------------------------- |
| Persistence | `@lindorm/proteus` | Repositories, caches, rate limit, rooms |
| Messaging   | `@lindorm/iris`    | Queues, audit log publishing            |

You will also need `@lindorm/logger` and `@lindorm/amphora` (key management) — both are required constructor arguments.

## Quick Start

```typescript
import { Pylon, PylonRouter, useHandler } from "@lindorm/pylon";
import { Logger } from "@lindorm/logger";
import { Amphora } from "@lindorm/amphora";

const router = new PylonRouter();

router.get(
  "/hello/:name",
  useHandler(async (ctx) => {
    return { body: { greeting: `Hello, ${ctx.params.name}!` } };
  }),
);

const app = new Pylon({
  port: 3000,
  amphora: new Amphora(),
  logger: new Logger({ readable: true }),
  httpRouters: [{ path: "/", router }],
});

await app.start();
```

## Table of Contents

- [Core Concepts](#core-concepts)
  - [Pylon](#pylon)
  - [PylonRouter](#pylonrouter)
  - [PylonListener](#pylonlistener)
  - [Context Object](#context-object)
- [HTTP Routing](#http-routing)
  - [File-Based Routing](#file-based-routing)
  - [Path Conventions](#path-conventions)
  - [Middleware Inheritance](#middleware-inheritance)
  - [Manual Routers](#manual-routers)
  - [Route Handlers](#route-handlers)
  - [File Downloads & Streams](#file-downloads--streams)
  - [Redirects](#redirects)
- [Socket.io Integration](#socketio-integration)
  - [File-Based Listeners](#file-based-listeners)
  - [Manual Listeners](#manual-listeners)
  - [Namespaces](#namespaces)
  - [Socket Authentication](#socket-authentication)
  - [Room Management](#room-management)
  - [Redis Adapter](#redis-adapter)
- [Middleware](#middleware)
  - [Authentication & Authorization](#authentication--authorization)
  - [Validation](#validation)
  - [Data Sources](#data-sources)
  - [Multi-Tenancy](#multi-tenancy)
  - [Rate Limiting](#rate-limiting)
  - [Audit Logging](#audit-logging)
  - [Conduit (HTTP Clients)](#conduit-http-clients)
- [OpenID Connect Authentication](#openid-connect-authentication)
- [Session Management](#session-management)
- [Webhooks](#webhooks)
- [Workers](#workers)
  - [Custom Workers](#custom-workers)
  - [Built-in Workers](#built-in-workers)
- [Health Check](#health-check)
- [Error Handling](#error-handling)
- [CORS](#cors)
- [Body Parsing](#body-parsing)
- [Configuration Reference](#configuration-reference)
- [Entities](#entities)
- [Command-Line Tools](#command-line-tools)

## Core Concepts

### Pylon

The main server class. Manages the HTTP server, optional Socket.io gateway, middleware pipeline, workers, and lifecycle hooks.

```typescript
const app = new Pylon({
  // Required
  amphora: myAmphora,
  logger: myLogger,

  // Server
  port: 3000,
  domain: "api.example.com",
  name: "my-service",
  version: "1.2.3",
  environment: "production",
  proxy: true,

  // HTTP
  httpRouters: [{ path: "/api", router: apiRouter }],
  httpMiddleware: [myMiddleware],
  cors: { allowOrigins: ["https://example.com"] },

  // Socket.io
  socketListeners: [chatListener],
  socketMiddleware: [mySocketMiddleware],
  socketRedis: redisClient,

  // Integrations
  proteus: myProteusSource,
  iris: myIrisSource,

  // Lifecycle
  setup: async () => {
    /* runs before listening */
  },
  teardown: async () => {
    /* runs on shutdown */
  },

  // Workers
  workers: [myWorker],
  workersInterval: "30s",
});
```

**Lifecycle methods:**

| Method       | Description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| `start()`    | Runs setup, starts HTTP server, starts workers, registers SIGINT/SIGTERM handlers |
| `stop()`     | Closes server, runs teardown, stops workers                                       |
| `setup()`    | Initializes Amphora, loads middleware and routers                                 |
| `teardown()` | Runs teardown hook                                                                |
| `callback`   | Property — returns the raw Node.js HTTP callback for testing                      |

### PylonRouter

HTTP router wrapping [koa-router](https://github.com/koajs/router) with automatic path-parameter parsing.

```typescript
import { PylonRouter } from "@lindorm/pylon";

const router = new PylonRouter();

router.get("/users", listUsers);
router.get("/users/:id", getUser);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.patch("/users/:id", patchUser);
router.delete("/users/:id", deleteUser);
router.head("/users/:id", headUser);
router.options("/users", optionsUsers);
router.all("/health", healthCheck);

// Global middleware on this router
router.use(authMiddleware);
```

**Supported HTTP methods:** `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `link`, `unlink`, `all`

Routes are chained — every method returns the router instance. The `routes()` and `allowedMethods()` getters expose the underlying Koa middleware for manual composition.

### PylonListener

Socket.io event listener builder with namespace support, middleware, and parent inheritance.

```typescript
import { PylonListener } from "@lindorm/pylon";

const listener = new PylonListener({
  namespace: "/chat",
  prefix: "msg:",
});

listener.on("send", async (ctx) => {
  ctx.rooms?.broadcast("general", "msg:receive", ctx.data);
});

listener.once("init", async (ctx) => {
  await ctx.rooms?.join("general");
});

// Inherit middleware from a parent listener
const child = new PylonListener({ namespace: "/chat/admin" });
child.parent(listener);
```

**Event methods:** `on`, `once`, `onAny`, `onAnyOutgoing`, `prependAny`, `prependAnyOutgoing`

### Context Object

Pylon provides a unified context object shared across HTTP and Socket.io handlers. Both transports get the same core properties:

```typescript
// Available on every handler (HTTP and Socket)
ctx.aegis; // JWT/JWS/CWT/CWS verification (via @lindorm/aegis)
ctx.amphora; // Key management (via @lindorm/amphora)
ctx.conduits; // HTTP clients (via @lindorm/conduit)
ctx.entities; // Entity registry
ctx.logger; // Per-request scoped logger

ctx.repositories; // Proteus repositories (via middleware)
ctx.caches; // Proteus caches (via middleware)
ctx.publishers; // Iris publishers (via middleware)
ctx.workerQueues; // Iris worker queues (via middleware)

ctx.proteus; // Proteus session (if configured)
ctx.iris; // Iris session (if configured)

ctx.queue(event, payload); // Enqueue a job (if queue enabled)
ctx.webhook(event, data); // Dispatch webhook (if webhook enabled)

ctx.state.app; // { domain, environment, name, version }
ctx.state.authorization; // { type: "basic"|"bearer"|"none", value }
ctx.state.metadata; // { id, correlationId, date, environment }
ctx.state.tenant; // Tenant ID (if useTenant middleware applied)
ctx.state.tokens; // Parsed JWT/JWS tokens
```

**HTTP-specific:**

```typescript
ctx.data; // Parsed request body (camelCased)
ctx.files; // Uploaded files (multipart)
ctx.params; // URL path parameters
ctx.session; // { set(), get(), del(), logout() }
ctx.io.app; // Socket.io server instance (if socket enabled)
ctx.rooms; // Room context: members(), presence() (if rooms enabled)
ctx.socket; // Envelope emitter: emit(target, event, data) (if socket enabled)
```

**Socket-specific:**

```typescript
ctx.data; // Event payload
ctx.event; // Event name
ctx.eventId; // Unique event ID
ctx.header; // Envelope headers
ctx.io.app; // Socket.io server instance
ctx.io.socket; // Raw Socket.io socket instance
ctx.ack; // Acknowledge callback
ctx.nack; // Negative acknowledge callback
ctx.rooms; // Room context: join(), leave(), members(), presence() (if rooms enabled)
ctx.socket; // Envelope emitter: emit(target, event, data), broadcast(target, event, data)
ctx.args; // Raw event arguments
```

## HTTP Routing

### File-Based Routing

Pass a directory path to `httpRouters` and Pylon scans it recursively, mapping files to routes:

```typescript
const app = new Pylon({
  httpRouters: "./src/routes",
  // ...
});
```

**Example directory:**

```
routes/
  _middleware.ts              → shared middleware for all routes
  health.ts                   → GET /health
  v1/
    _middleware.ts            → shared middleware for /v1/*
    users/
      index.ts               → GET /v1/users, POST /v1/users
      [id].ts                → GET /v1/users/:id, PUT /v1/users/:id, DELETE /v1/users/:id
    proxy/
      [...path].ts           → GET /v1/proxy/* (catch-all)
```

**Route file exports:**

Each file exports HTTP method handlers as named constants — either a single handler or an array of middleware + handler:

```typescript
// routes/v1/users/index.ts

export const GET = async (ctx) => {
  ctx.body = await listUsers();
  ctx.status = 200;
};

const validateBody = async (ctx, next) => {
  // validate ctx.data
  await next();
};

const createUser = async (ctx) => {
  ctx.body = await insertUser(ctx.data);
  ctx.status = 201;
};

export const POST = [validateBody, createUser];
```

Supported exports: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

Alternatively, export a `PylonRouter` instance for full control:

```typescript
// routes/custom.ts
import { PylonRouter } from "@lindorm/pylon";

export const router = new PylonRouter();
router.get("/", handler);
router.post("/nested", otherHandler);
```

### Path Conventions

| File / Directory Name  | Route Segment | Description                                       |
| ---------------------- | ------------- | ------------------------------------------------- |
| `users.ts`             | `/users`      | Literal segment                                   |
| `index.ts`             | (none)        | Directory root handler                            |
| `[id].ts`              | `/:id`        | Dynamic parameter                                 |
| `[...path].ts`         | `/*path`      | Catch-all parameter                               |
| `[[...slug]].ts`       | `/*slug`      | Optional catch-all                                |
| `(admin)/dashboard.ts` | `/dashboard`  | Group (stripped from path, for code organization) |
| `_middleware.ts`       | (none)        | Middleware file, not a route                      |

### Middleware Inheritance

Place a `_middleware.ts` file at any directory level. It must export a `MIDDLEWARE` constant:

```typescript
// routes/_middleware.ts
export const MIDDLEWARE = [corsMiddleware, loggingMiddleware];

// routes/v1/_middleware.ts
export const MIDDLEWARE = [bearerAuth];
```

Middleware is inherited top-down. A handler at `routes/v1/users/[id].ts` receives middleware from:

1. `routes/_middleware.ts` (root)
2. `routes/v1/_middleware.ts` (parent)
3. The handler's own middleware array

### Manual Routers

For programmatic routing, pass an array of `{ path, router }` objects:

```typescript
const app = new Pylon({
  httpRouters: [
    { path: "/api", router: apiRouter },
    { path: "/admin", router: adminRouter },
  ],
  // ...
});
```

### Route Handlers

Use `useHandler` to wrap route logic. It standardises response formatting and supports body, file, stream, and redirect responses:

```typescript
import { useHandler } from "@lindorm/pylon";

router.post(
  "/users",
  useHandler(async (ctx) => {
    const user = await createUser(ctx.data);

    return {
      status: 201,
      body: { id: user.id, name: user.name },
    };
  }),
);
```

Path parameters are automatically parsed from the URL and available on `ctx.params`:

```typescript
router.get(
  "/users/:userId/posts/:postId",
  useHandler(async (ctx) => {
    const { userId, postId } = ctx.params;
    // ...
  }),
);
```

### File Downloads & Streams

```typescript
// Static file
router.get(
  "/download",
  useHandler(async (ctx) => {
    return {
      file: {
        path: "/path/to/report.pdf",
        options: { immutable: true, maxAge: 86400 },
      },
    };
  }),
);

// Readable stream
router.get(
  "/export",
  useHandler(async (ctx) => {
    return {
      stream: {
        stream: fs.createReadStream("/data/export.csv"),
        contentLength: 10240,
        lastModified: new Date(),
        mimeType: "text/csv",
        filename: "export.csv",
      },
    };
  }),
);
```

### Redirects

```typescript
router.get(
  "/old-page",
  useHandler(async (ctx) => {
    return { redirect: "https://example.com/new-page" };
  }),
);

// Location header without redirect
router.post(
  "/resources",
  useHandler(async (ctx) => {
    return {
      status: 201,
      body: resource,
      location: `/resources/${resource.id}`,
    };
  }),
);
```

## Socket.io Integration

### File-Based Listeners

Pass a directory path to `socketListeners` for automatic event scanning:

```typescript
const app = new Pylon({
  socketListeners: "./src/listeners",
  // ...
});
```

**Example directory:**

```
listeners/
  _middleware.ts              → shared middleware for all events
  echo.ts                     → event: "echo"
  disconnect.ts               → event: "disconnect"
  chat/
    _middleware.ts            → shared middleware for chat:*
    message.ts                → event: "chat:message"
```

> **Note:** Room join/leave events (`rooms:{roomId}:join`, `rooms:{roomId}:leave`) are auto-registered when rooms are enabled — you don't need listener files for them. See [Room Management](#room-management).

**Listener file exports:**

Each file exports an `ON` or `ONCE` handler (single function or array):

```typescript
// listeners/echo.ts
export const ON = async (ctx) => {
  ctx.ack?.({ text: ctx.data?.text, event: ctx.event });
};

// listeners/chat/message.ts
const validateMessage = async (ctx, next) => {
  /* ... */ await next();
};
const handleMessage = async (ctx) => {
  /* ... */
};
export const ON = [validateMessage, handleMessage];
```

Middleware files work identically to HTTP — export `MIDDLEWARE` from `_middleware.ts`, inherited top-down.

### Manual Listeners

For programmatic listener setup, pass an array of `PylonListener` instances:

```typescript
const app = new Pylon({
  socketListeners: [chatListener, adminListener],
  // ...
});
```

### Namespaces

```typescript
const adminListener = new PylonListener({ namespace: "/admin" });

adminListener.on("command", adminAuthMiddleware, async (ctx) => {
  // Only reachable via io.connect("/admin")
});
```

### Socket Authentication

Pylon supports two authentication strategies for socket connections: **bearer tokens** and **sessions (cookies)**. Authentication is established once at handshake time, then enforced reactively on each event.

#### Connection Middleware

Use `connectionMiddleware` to run middleware once during the Socket.io handshake, before the connection is established. This is a separate chain from per-event middleware and uses the `PylonConnectionMiddleware` type.

```typescript
import { Pylon, createHandshakeTokenMiddleware } from "@lindorm/pylon";

const app = new Pylon({
  // ...
  socket: {
    enabled: true,
    listeners: "./src/listeners",
    connectionMiddleware: [
      createHandshakeTokenMiddleware({ issuer: "https://auth.example.com" }),
    ],
  },
});
```

Connection middleware receives a `PylonSocketHandshakeContext` and runs in order before any event listeners are registered. If any middleware throws, the handshake is rejected and the socket never connects.

#### Handshake Token Middleware

`createHandshakeTokenMiddleware(options)` verifies a bearer token at handshake and populates `socket.data.pylon.auth` for downstream use.

**Options** (extends `VerifyJwtOptions` from `@lindorm/aegis`):

| Option     | Type                                     | Required | Description                              |
| ---------- | ---------------------------------------- | -------- | ---------------------------------------- |
| `issuer`   | `string`                                 | Yes      | Expected token issuer                    |
| `audience` | `string`                                 | No       | Expected token audience                  |
| `dpop`     | `"required" \| "optional" \| "disabled"` | No       | DPoP enforcement (default: `"optional"`) |

**Token source resolution** is automatic: the middleware tries `handshake.auth.bearer` first, then falls back to the session cookie if present. When both are available, the explicit bearer token wins.

If neither source provides a token, the middleware throws a `ClientError` with status 401.

#### Session Mode (Cookie Auth)

When `session` is configured on the Pylon constructor, session middleware is auto-wired for both HTTP and socket transports. No `connectionMiddleware` entry is needed.

```typescript
const app = new Pylon({
  cors: { allowOrigins: ["https://app.example.com"] },
  session: { enabled: true, expiry: "90 minutes" },
  socket: { enabled: true, listeners: "./src/listeners" },
  // ...
});
```

The auto-wired session connection middleware is **non-rejecting**: if no session cookie is present, the handshake proceeds and public events still work. Only events guarded by `createAccessTokenMiddleware` will require a valid session.

**Safety:** Session + socket requires an explicit CORS allowlist (not `"*"`). Pylon throws a `PylonError` at construction if `session` is set without a proper `cors.allowOrigins` list, to prevent Cross-Site WebSocket Hijacking.

#### Auth Refresh Protocol

Pylon automatically registers a refresh listener when handshake auth state is established. Two reserved events handle the refresh lifecycle:

| Event                 | Direction        | Description                                                 |
| --------------------- | ---------------- | ----------------------------------------------------------- |
| `$pylon/auth/refresh` | client to server | Refreshes the auth state on the server                      |
| `$pylon/auth/expired` | server to client | Advisory warning emitted in the 60-second pre-expiry window |

No user wiring is needed — the `$pylon/auth/refresh` listener is auto-registered when `socket.data.pylon.auth` is set during the handshake phase.

**Refresh payload** depends on the auth strategy:

- **Bearer mode:** `{ bearer: string, expiresIn: number }` — client sends a new token.
- **Session mode:** `{}` — the server re-reads the session from the store.

**Failure behaviour:**

- Bearer: an error ack is returned, the socket stays connected (the old token may still be valid).
- Session: an error ack is returned and the socket is **disconnected** (the session is gone).

The ack response follows the shape `{ __pylon: true, ok: boolean, data?: unknown, error?: { code, message, name, status } }`.

#### Per-Event Freshness

After the handshake, `createAccessTokenMiddleware` uses a fast path for socket events — it checks the auth state established at handshake time rather than re-verifying the token on every event:

- **Token well before expiry** — event accepted silently.
- **Token in 60-second warning window** — `$pylon/auth/expired` is emitted once, event is still accepted.
- **Token past expiry** — event rejected with a 401 `ClientError` and the socket is disconnected.

There are no server-side timers. Pylon is reactive — the client owns timing and sends `$pylon/auth/refresh` before expiry.

### Room Management

Enable room support with the `rooms` option on Pylon:

```typescript
const app = new Pylon({
  rooms: { presence: true },
  proteus: mySource,
  // ...
});
```

When rooms are enabled, Pylon provides `ctx.rooms` and `ctx.socket` automatically on both HTTP and socket contexts — lazily initialised, no middleware needed.

**`ctx.rooms`** manages room membership and presence:

```typescript
listener.on("game:start", async (ctx) => {
  await ctx.rooms.join("game-lobby");
  const members = await ctx.rooms.members("game-lobby");
});
```

**`ctx.socket`** emits Pylon envelopes to targets (room names or socket IDs):

```typescript
// From a socket listener — emit to a room
ctx.socket.emit("game-lobby", "game:player-joined", { userId: "abc" });

// Broadcast excludes the sender (socket context only)
ctx.socket.broadcast("game-lobby", "game:player-joined", { userId: "abc" });

// From an HTTP handler — e.g. POST /v1/notify called by another service
ctx.socket.emit(`user:${userId}`, "mfa:challenge", { challengeId, device, ip });
```

All emissions are automatically wrapped in the Pylon envelope format (`{ __pylon: true, header: { correlationId }, payload }`) so Zephyr clients receive them correctly.

**Built-in join/leave handlers** — Pylon auto-registers parameterised listeners for room join and leave events:

| Event Pattern          | Action                          | Response                        |
| ---------------------- | ------------------------------- | ------------------------------- |
| `rooms:{roomId}:join`  | Calls `ctx.rooms.join(roomId)`  | Ack on success, nack on failure |
| `rooms:{roomId}:leave` | Calls `ctx.rooms.leave(roomId)` | Ack on success, nack on failure |

Clients join/leave rooms by emitting these events. The response uses the Pylon ack/nack envelope, so `emitWithAck` resolves on success and rejects on failure:

```typescript
// Client-side (socket.io-client or @lindorm/zephyr)
await socket.emitWithAck("rooms:lobby:join", {});
// → { __pylon: true, ok: true, data: { room: "lobby" } }
```

**Overriding built-in handlers:** If you define your own listener for `rooms/[roomId]/join.ts`, it takes precedence over the built-in handler. This lets you add custom logic (e.g. authorisation checks) before joining:

```typescript
// listeners/rooms/[roomId]/join.ts
export const ON = async (ctx) => {
  if (!canJoinRoom(ctx.state.tokens, ctx.params.roomId)) {
    ctx.nack?.({ code: "forbidden", message: "Not allowed to join this room" });
    return;
  }
  await ctx.rooms.join(ctx.params.roomId);
  ctx.ack?.({ room: ctx.params.roomId });
};
```

**Room context methods:**

| Method           | HTTP | Socket | Description                                                                  |
| ---------------- | ---- | ------ | ---------------------------------------------------------------------------- |
| `join(room)`     | —    | yes    | Add the socket to a Socket.IO room                                           |
| `leave(room)`    | —    | yes    | Remove the socket from a room                                                |
| `members(room)`  | yes  | yes    | Returns socket IDs of all members                                            |
| `presence(room)` | yes  | yes    | Returns `{ userId, socketId, joinedAt }` records (requires `presence: true`) |

**Socket emitter methods:**

| Method                            | HTTP | Socket | Description                                             |
| --------------------------------- | ---- | ------ | ------------------------------------------------------- |
| `emit(target, event, data?)`      | yes  | yes    | Emit Pylon envelope to all sockets in target            |
| `broadcast(target, event, data?)` | —    | yes    | Emit Pylon envelope to target, **excluding** the sender |

The `target` argument is a Socket.IO room name, a socket ID, or any named group — Socket.IO treats them all the same.

**Presence tracking** requires a Proteus source and stores presence records as entities. Enable with `rooms: { presence: true }`. The user ID is extracted from the access token (`subject` claim) when available, falling back to the socket ID.

### Redis Adapter

For horizontal scaling across multiple server instances:

```typescript
import Redis from "ioredis";

const app = new Pylon({
  socketRedis: new Redis("redis://localhost:6379"),
  // ...
});
```

## Middleware

### Authentication & Authorization

**Bearer token verification:**

```typescript
import { createBearerTokenMiddleware } from "@lindorm/pylon";

const bearerAuth = createBearerTokenMiddleware({
  issuer: "https://auth.example.com",
  audience: "my-api",
});

router.get(
  "/protected",
  bearerAuth,
  useHandler(async (ctx) => {
    const token = ctx.state.tokens.accessToken;
    return { body: { subject: token.payload.sub } };
  }),
);
```

**Basic auth:**

```typescript
import { createBasicAuthMiddleware } from "@lindorm/pylon";

const basicAuth = createBasicAuthMiddleware([{ username: "admin", password: "secret" }]);

// Or with a custom verify function
const basicAuth = createBasicAuthMiddleware(async (username, password) => {
  return await verifyCredentials(username, password);
});
```

**Role & permission checks:**

```typescript
import { useRoles, usePermissions, useAccess } from "@lindorm/pylon";

// Require at least one role
router.post("/admin", useRoles("admin", "superadmin"), handler);

// Require all permissions
router.delete("/users/:id", usePermissions("users:write", "users:delete"), handler);

// Combined access check
router.put(
  "/sensitive",
  useAccess({
    roles: ["admin"],
    permissions: ["data:write"],
    scopes: ["openid", "profile"],
    levelOfAssurance: 3,
    adjustedAccessLevel: 2,
  }),
  handler,
);
```

**Generic token validation:**

```typescript
import { useValidation, createTokenMiddleware } from "@lindorm/pylon";

// Validate existing token at path
router.use(useValidation("accessToken", { issuer: "https://auth.example.com" }));

// Custom token from header/body/query
const verifyApiKey = createTokenMiddleware({
  contextKey: "apiKey",
  issuer: "https://keys.example.com",
});
router.use(verifyApiKey("x-api-key"));
```

### Validation

Validate and coerce request data with [Zod](https://zod.dev/):

```typescript
import { useSchema } from "@lindorm/pylon";
import { z } from "zod/v4";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  age: z.number().int().min(0).optional(),
});

router.post(
  "/users",
  useSchema(CreateUserSchema), // validates ctx.data (default)
  useHandler(async (ctx) => {
    // ctx.data is typed and validated
    return { status: 201, body: ctx.data };
  }),
);

// Validate other targets
router.get(
  "/search",
  useSchema(SearchParamsSchema, "query"), // validates ctx.query
  useSchema(RequiredHeadersSchema, "headers"), // validates ctx.headers
  handler,
);
```

Supported paths: `"data"` (default), `"body"`, `"headers"`, `"params"`, `"query"`, or any dot-path on context.

### Data Sources

Lazily initialise Proteus repositories, caches, Iris publishers, or worker queues on the context:

```typescript
import {
  createRepositoryMiddleware,
  createCacheMiddleware,
  createPublisherMiddleware,
  createWorkerQueueMiddleware,
} from "@lindorm/pylon";

router.use(createRepositoryMiddleware([User, Post]));
router.use(createCacheMiddleware([Session]));
router.use(createPublisherMiddleware([OrderPlaced]));
router.use(createWorkerQueueMiddleware([ProcessOrder]));

router.get(
  "/users",
  useHandler(async (ctx) => {
    // Repositories named by camelCased entity name
    const users = await ctx.repositories.user.find();
    return { body: users };
  }),
);
```

Each middleware accepts an optional second argument to override the global Proteus/Iris source.

### Multi-Tenancy

```typescript
import { useTenant, useScope } from "@lindorm/pylon";

// Extract tenant from access token (default path)
router.use(useTenant());

// Or from a custom token path
router.use(useTenant("apiKey.payload.tenantId", { required: true }));

// Apply scope filtering to Proteus queries
router.use(
  useScope({
    params: (ctx) => ({ tenantId: ctx.state.tenant }),
  }),
);
```

### Rate Limiting

Three strategies backed by Proteus storage:

```typescript
import { useRateLimit } from "@lindorm/pylon";

// Fixed window (default)
router.use(useRateLimit({ window: "1m", max: 60 }));

// Sliding window
router.use(useRateLimit({ window: "1m", max: 60, strategy: "sliding" }));

// Token bucket
router.use(useRateLimit({ window: "1m", max: 60, strategy: "token-bucket" }));

// Custom key and skip
router.use(
  useRateLimit({
    window: "15m",
    max: 100,
    key: (ctx) => ctx.state.tokens.accessToken?.payload.sub ?? ctx.request.ip,
    skip: (ctx) => ctx.path === "/health",
  }),
);
```

Returns standard rate-limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

Enable globally via the `rateLimit` option on Pylon for both HTTP and Socket.io.

### Audit Logging

Publish request audit events via Iris:

```typescript
import { useAuditLog } from "@lindorm/pylon";

router.use(
  useAuditLog({
    sanitise: (body) => ({ ...body, password: "[REDACTED]" }),
    skip: (ctx) => ctx.path === "/health",
  }),
);
```

Captures: endpoint, method, transport (HTTP/socket), status code, duration, source IP, user agent, session ID, and request body.

For data-level audit (entity change tracking), use the `audit` option on Pylon with entity targets.

### Conduit (HTTP Clients)

Create pre-configured HTTP clients with automatic correlation and session propagation:

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

Conduits automatically forward the correlation ID and session ID from the current request.

## OpenID Connect Authentication

Pylon can act as an OpenID Connect Relying Party with a single configuration block:

```typescript
const app = new Pylon({
  auth: {
    clientId: "my-client-id",
    clientSecret: "my-client-secret",
    issuer: "https://auth.example.com",
    pathPrefix: "/auth",
    codeChallengeMethod: "S256",
    errorRedirect: "/error",
    defaults: {
      scope: ["openid", "profile", "email"],
      responseType: "code",
    },
    expose: {
      accessToken: true,
      idToken: true,
    },
    refresh: {
      mode: "half_life",
    },
  },
  session: { enabled: true },
  // ...
});
```

**Auto-created routes:**

| Route                              | Purpose                  |
| ---------------------------------- | ------------------------ |
| `GET /:prefix/login`               | Start authorization flow |
| `GET /:prefix/login/callback`      | Handle OIDC callback     |
| `GET /:prefix/logout`              | Start logout flow        |
| `GET /:prefix/logout/callback`     | Handle logout callback   |
| `GET /:prefix/userinfo`            | Fetch user info          |
| `POST /:prefix/backchannel-logout` | RP-initiated logout      |

## Session Management

Cookie-based sessions with configurable encryption:

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
  // ...
});
```

**Session context methods:**

```typescript
await ctx.session.set({ id, accessToken, subject, issuedAt, expiresAt, scope });
const session = await ctx.session.get();
await ctx.session.del();
await ctx.session.logout(subject);
```

## Webhooks

Subscribe external URLs to application events:

```typescript
const app = new Pylon({
  webhook: {
    enabled: true,
    proteus: mySource,
    iris: myIrisSource,
    encryptionKey: myKryptos,
  },
  // ...
});
```

Pylon ships a `WebhookSubscription` entity with support for four authentication methods:

| Auth Method          | Description                       |
| -------------------- | --------------------------------- |
| `none`               | No authentication                 |
| `auth_headers`       | Custom headers per subscription   |
| `basic`              | HTTP Basic with username/password |
| `client_credentials` | OAuth2 client credentials flow    |

**Dispatch from any handler:**

```typescript
await ctx.webhook("user.created", { userId: "abc-123", email: "alice@example.com" });
```

Pylon matches the event against all active subscriptions and dispatches with the configured auth.

**Automatic suspension on repeated failures:**

Each subscription tracks `errorCount`, `lastErrorAt`, and `suspendedAt`. When a dispatch fails, the dispatch consumer increments `errorCount` and records `lastErrorAt`. After `maxErrors` consecutive failures (default: 10), `suspendedAt` is set and the subscription is skipped by the request consumer until it is reset.

```typescript
const app = new Pylon({
  webhook: {
    enabled: true,
    proteus: mySource,
    iris: myIrisSource,
    encryptionKey: myKryptos,
    maxErrors: 20,
  },
  // ...
});
```

To reactivate a suspended subscription, update it (PATCH-style) and clear `errorCount` and `suspendedAt` via your own CRUD route.

## Workers

Background jobs with configurable intervals, retry logic, and jitter.

### Custom Workers

```typescript
const app = new Pylon({
  workers: [
    {
      alias: "SyncInventory",
      interval: "5m",
      jitter: true,
      retry: { retries: 3, minTimeout: "1s" },
      callback: async (ctx) => {
        await syncExternalInventory(ctx.logger);
      },
    },
  ],
  workersInterval: "30s", // Default interval for workers without one
  // ...
});
```

### Built-in Workers

Pylon provides factory functions for common operational tasks:

```typescript
import {
  createAmphoraRefreshWorker,
  createAmphoraEntityWorker,
  createKryptosRotationWorker,
  createExpiryCleanupWorker,
} from "@lindorm/pylon";
```

**`createAmphoraRefreshWorker`** — Refreshes Amphora keys on an interval (default: 15 minutes). Keeps JWKS discovery in sync.

**`createAmphoraEntityWorker`** — Loads cryptographic keys from a Proteus entity into Amphora. Optionally decrypts private keys with an AES encryption key.

**`createKryptosRotationWorker`** — Generates and rotates cryptographic keys on a schedule (default: 1 day). Default key set:

| Algorithm           | Purpose |
| ------------------- | ------- |
| `dir`               | cookie  |
| `HS256`             | cookie  |
| `EdDSA`             | session |
| `ECDH-ES`           | session |
| `ES512`             | token   |
| `ECDH-ES+A128GCMKW` | token   |

**`createExpiryCleanupWorker`** — Deletes expired entities from specified targets (default: every 15 minutes).

**`createAmphoraEntityWorker`** — Syncs `KryptosDB` entities from the configured Proteus source into the Amphora key cache on an interval (default: 3 minutes). Uses Pylon's built-in `Kryptos` entity by default; pass `target` to override.

```typescript
const app = new Pylon({
  workers: [
    createAmphoraRefreshWorker({ amphora: myAmphora, logger: myLogger }),
    createKryptosRotationWorker({ proteus: mySource, logger: myLogger }),
    createAmphoraEntityWorker({
      amphora: myAmphora,
      proteus: mySource,
      logger: myLogger,
    }),
    createExpiryCleanupWorker({
      proteus: mySource,
      targets: [Session, OtpCode],
      logger: myLogger,
    }),
  ],
  // ...
});
```

Each factory returns a `LindormWorker` instance. You can also default-export a built worker from a file and pass `"./src/workers"` as a string — the scanner picks up instance exports automatically.

`createKryptosRotationWorker` and `createAmphoraEntityWorker` default to Pylon's built-in `Kryptos` entity. Pass `target: MyKryptosEntity` to override with a custom `KryptosDB` implementation.

## Health Check

Pylon exposes a `GET /health` endpoint automatically. When no custom callback is configured, Pylon builds a default health callback based on the integrations in use:

- If `proteus` is provided, the callback pings the configured source.
- If `iris` is provided, the callback pings the broker.
- If both fail, the response is `503 Service Unavailable` with a `health_check_failed` error code and `failures: ["proteus" | "iris", ...]`.
- When everything is healthy (or when neither integration is configured), `/health` returns `204 No Content`.

**Override with a custom callback:**

```typescript
const app = new Pylon({
  callbacks: {
    health: async (ctx) => {
      await checkDownstream();
    },
  },
  // ...
});
```

**Disable the probe entirely:**

```typescript
const app = new Pylon({
  callbacks: { health: null }, // /health returns 204 unconditionally
  // ...
});
```

## Error Handling

Throw any `LindormError` inside a route or middleware and Pylon converts it into a structured JSON response:

```typescript
import { ClientError, ServerError } from "@lindorm/errors";

router.get(
  "/users/:id",
  useHandler(async (ctx) => {
    const user = await findUser(ctx.params.id);

    if (!user) {
      throw new ClientError("User not found", { status: 404 });
    }

    return { body: user };
  }),
);
```

**Response format** (`application/json`):

```json
{
  "error": "ClientError",
  "message": "User not found",
  "statusCode": 404,
  "timestamp": "2026-04-05T12:00:00.000Z"
}
```

**Framework error classes:**

| Class           | Purpose                                       |
| --------------- | --------------------------------------------- |
| `PylonError`    | Base framework error (extends `LindormError`) |
| `RedirectError` | OAuth redirect with state and URI             |
| `CorsError`     | CORS policy violation (extends `ClientError`) |

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
  // ...
});
```

Use `"*"` for `allowOrigins`, `allowMethods`, or `allowHeaders` to allow everything.

## Body Parsing

Pylon parses JSON, URL-encoded forms, and multipart uploads out of the box:

```typescript
const app = new Pylon({
  parseBody: {
    json: "5Mb",
    form: "100Kb",
    text: "1Kb",
    multipart: true,
    formidable: true,
    formidableOptions: {
      maxFileSize: 50 * 1024 * 1024,
    },
    methods: ["POST", "PUT", "PATCH"],
  },
  // ...
});
```

Parsed body is available as `ctx.data` (camelCased). Uploaded files are available as `ctx.files`.

## Configuration Reference

### Type-Safe Socket Emissions

Use `PylonEventMap` to get type-safe `ctx.socket.emit()` calls:

```typescript
import { Pylon, PylonEventMap } from "@lindorm/pylon";

type MyEvents = {
  "mfa:challenge": { challengeId: string; device: string; ip: string };
  "chat:message": { text: string; sender: string };
};

const app = new Pylon<MyEvents>({
  // ...
});

// In handlers:
ctx.socket.emit("user:abc", "mfa:challenge", { challengeId, device, ip }); // ✓ typed
ctx.socket.emit("user:abc", "mfa:challenge", { wrong: "shape" }); // ✗ type error
```

The event map is a flat `Record<string, PayloadType>`. It types only emissions — listener handlers define their own incoming types via the handler signature.

Full type signature of `PylonOptions`:

```typescript
type PylonOptions<E extends PylonEventMap = PylonEventMap> = {
  // Required
  amphora: IAmphora;
  logger: ILogger;

  // Server
  port?: number; // Default: 3000
  domain?: string;
  name?: string;
  version?: string; // Default: "0.0.0"
  environment?: Environment;
  proxy?: boolean; // Default: true

  // HTTP
  auth?: PylonAuthOptions;
  callbacks?: { health?: PylonHttpCallback | null; rightToBeForgotten? };
  changePasswordUri?: string;
  cookies?: PylonCookieConfig;
  cors?: CorsOptions;
  httpMiddleware?: PylonHttpMiddleware[];
  httpRouters?: string | PylonHttpRouters[];
  maxRequestAge?: ReadableTime;
  minRequestAge?: ReadableTime;
  openIdConfiguration?: Partial<OpenIdConfigurationOptions>;
  parseBody?: ParseBodyOptions;
  session?: PylonSessionOptions;

  // Socket.io
  socketListeners?: string | PylonListener[];
  socketMiddleware?: PylonSocketMiddleware[];
  socketOptions?: Partial<SocketOptions>;
  socketRedis?: Redis;

  // Integrations
  hermes?: IHermes;
  iris?: IIrisSource;
  proteus?: IProteusSource;

  // Features
  audit?: PylonAuditOptions;
  kryptos?: PylonKryptosOptions;
  queue?: PylonQueueOptions;
  rateLimit?: PylonRateLimitOptions;
  rooms?: PylonRoomsOptions;
  webhook?: PylonWebhookOptions;

  // Lifecycle
  setup?: () => Promise<string | void>;
  teardown?: () => Promise<string | void>;
  subscriptions?: PylonSubscribeOptions[];

  // Workers
  workers?: Array<ILindormWorker | string>;
  workersInterval?: ReadableTime;
  workersRetry?: RetryOptions;
};
```

## Entities

Pylon ships three Proteus entities for its built-in features:

| Entity                | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `DataAuditLog`        | Tracks entity-level changes (field diffs)         |
| `Presence`            | Room presence records (requires `rooms.presence`) |
| `RequestAuditLog`     | Stores HTTP/socket request audit records          |
| `WebhookSubscription` | Manages webhook targets and their authentication  |

Import them from the main entry point:

```typescript
import { DataAuditLog, RequestAuditLog, WebhookSubscription } from "@lindorm/pylon";
```

## Command-Line Tools

Pylon ships a `pylon` CLI for scaffolding route, listener, middleware, handler, and worker files. With `@lindorm/pylon` installed, invoke it via `npx pylon` or `./node_modules/.bin/pylon`.

```bash
pylon --help
pylon generate --help
```

All `generate` commands prompt interactively when required arguments are omitted and support `--dry-run` to print the generated file without writing to disk.

### `pylon generate route`

```bash
pylon generate route [methods] [path] [options]
```

| Argument  | Example         | Description                                                                 |
| --------- | --------------- | --------------------------------------------------------------------------- |
| `methods` | `GET,POST`      | Comma-separated HTTP methods                                                |
| `path`    | `/v1/users/:id` | URL path — `:params` become `[param]` segments; `*rest` becomes `[...rest]` |

| Option                   | Default        | Description                                    |
| ------------------------ | -------------- | ---------------------------------------------- |
| `-d, --directory <path>` | `./src/routes` | Output directory                               |
| `--dry-run`              | —              | Print the generated file instead of writing it |

**Example:** `pylon generate route GET,POST /v1/users/:id` → `./src/routes/v1/users/[id].ts`

### `pylon generate listener`

```bash
pylon generate listener [bindings] [event] [options]
```

| Argument   | Example           | Description                                                     |
| ---------- | ----------------- | --------------------------------------------------------------- |
| `bindings` | `ON` or `ON,ONCE` | Comma-separated bindings — valid values: `ON`, `ONCE`           |
| `event`    | `chat:message`    | Colon-separated event name — colons become directory separators |

| Option                   | Default           | Description                                    |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `-d, --directory <path>` | `./src/listeners` | Output directory                               |
| `--dry-run`              | —                 | Print the generated file instead of writing it |

**Example:** `pylon generate listener ON chat:message` → `./src/listeners/chat/message.ts`

### `pylon generate middleware`

```bash
pylon generate middleware [path] [options]
```

Generates a `_middleware.ts` file exporting a `MIDDLEWARE` array for inheritance.

| Option                   | Default                                                 | Description                                    |
| ------------------------ | ------------------------------------------------------- | ---------------------------------------------- |
| `-d, --directory <path>` | `./src/routes` (HTTP) or `./src/listeners` (`--socket`) | Output directory                               |
| `-S, --socket`           | off                                                     | Generate socket middleware (default is HTTP)   |
| `--dry-run`              | —                                                       | Print the generated file instead of writing it |

**Example:** `pylon generate middleware /v1/admin` → `./src/routes/v1/admin/_middleware.ts`

### `pylon generate handler`

```bash
pylon generate handler [name] [options]
```

Generates a handler file with a Zod schema stub and a typed `ServerHandler` export. Filenames are camelCase.

| Option                   | Default          | Description                                    |
| ------------------------ | ---------------- | ---------------------------------------------- |
| `-d, --directory <path>` | `./src/handlers` | Output directory                               |
| `--dry-run`              | —                | Print the generated file instead of writing it |

**Example:** `pylon generate handler getUser` → `./src/handlers/getUser.ts`

### `pylon generate worker`

```bash
pylon generate worker [name] [options]
```

Generates a worker file with `CALLBACK` and `INTERVAL` named exports, matching Pylon's file-based worker scanner convention. Filenames are kebab-cased.

| Option                   | Default         | Description                                    |
| ------------------------ | --------------- | ---------------------------------------------- |
| `-d, --directory <path>` | `./src/workers` | Output directory                               |
| `--dry-run`              | —               | Print the generated file instead of writing it |

**Example:** `pylon generate worker HeartbeatWorker` → `./src/workers/heartbeat-worker.ts`

## License

AGPL-3.0-or-later — see the root [`LICENSE`](../../LICENSE).
