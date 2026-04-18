# @lindorm/zephyr

Type-safe **real-time WebSocket client** for Node.js and React, built on [Socket.IO](https://socket.io/). Provides event-driven communication with middleware composition, room management, request/response patterns, and first-class React hooks.

## Installation

```bash
npm install @lindorm/zephyr
```

Peer dependencies vary by feature:

| Feature | Peer Dependency    | Required When              |
| ------- | ------------------ | -------------------------- |
| Logging | `@lindorm/logger`  | Structured logging desired |
| React   | `react` (>=18.0.0) | Using React hooks/provider |

## Quick Start

```typescript
import { createBearerAuthStrategy, Zephyr } from "@lindorm/zephyr";

const client = new Zephyr({
  url: "https://api.example.com",
  auth: createBearerAuthStrategy({
    getBearerCredentials: async () => ({
      bearer: await getAccessToken(),
      expiresIn: 3600,
    }),
  }),
});

await client.connect();

// Fire-and-forget
await client.emit("analytics:track", { event: "page_view" });

// Request/response with acknowledgement
const users = await client.request("users:list", { page: 1 });

// Listen for events
client.on("notifications:new", (data) => {
  console.log("New notification:", data);
});
```

## Table of Contents

- [Core Concepts](#core-concepts)
  - [Zephyr Client](#zephyr-client)
  - [Event Map Typing](#event-map-typing)
  - [Middleware](#middleware)
  - [Rooms](#rooms)
- [Connection Management](#connection-management)
  - [Authentication](#authentication)
  - [Auth Refresh](#auth-refresh)
  - [Lifecycle Handlers](#lifecycle-handlers)
  - [Auto-Connect](#auto-connect)
- [Events](#events)
  - [Emit (Fire-and-Forget)](#emit-fire-and-forget)
  - [Request (Acknowledgement)](#request-acknowledgement)
  - [Listeners](#listeners)
- [Room Management](#room-management)
- [Middleware](#middleware-1)
- [Wire Protocol](#wire-protocol)
- [React Auth Bridge](#react-auth-bridge)
- [React Integration](#react-integration)
  - [ZephyrProvider](#zephyrprovider)
  - [useZephyr](#usezephyr)
  - [useRequest](#userequest)
  - [useEvent](#useevent)
  - [useRoom](#useroom)
- [Testing](#testing)
- [Configuration Reference](#configuration-reference)
- [Error Handling](#error-handling)

## Core Concepts

| Concept    | Description                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| Zephyr     | Main client class — manages connection, events, middleware, and rooms       |
| EventMap   | Generic type parameter for compile-time event payload safety                |
| Middleware | Composable request/response transformations via `@lindorm/middleware`       |
| Room       | Namespace-scoped communication channel with automatic event prefixing       |
| Envelope   | Wire protocol wrapping payloads with headers, correlation IDs, and metadata |

### Zephyr Client

The `Zephyr` class is the primary entry point. It wraps a Socket.IO client with middleware composition, envelope formatting, and typed event handling.

```typescript
import { Zephyr } from "@lindorm/zephyr";

const client = new Zephyr({
  url: "https://api.example.com",
  namespace: "/chat",
  timeout: 10000,
  logger: myLogger,
});
```

**Properties:**

| Property    | Type                  | Description                     |
| ----------- | --------------------- | ------------------------------- |
| `id`        | `string \| undefined` | Socket ID (set after connect)   |
| `connected` | `boolean`             | Whether the socket is connected |

### Event Map Typing

Define a `ZephyrEventMap` to get compile-time type safety for all event payloads:

```typescript
import { Zephyr, ZephyrEventMap } from "@lindorm/zephyr";

interface MyEvents extends ZephyrEventMap {
  "users:list": {
    outgoing: { page: number; limit?: number };
    incoming: { users: Array<{ id: string; name: string }> };
  };
  "users:created": {
    outgoing: never;
    incoming: { id: string; name: string };
  };
}

const client = new Zephyr<MyEvents>({
  url: "https://api.example.com",
});

// Fully typed - outgoing and incoming payloads are checked
const result = await client.request("users:list", { page: 1 });
// result is typed as { users: Array<{ id: string; name: string }> }

client.on("users:created", (data) => {
  // data is typed as { id: string; name: string }
});
```

### Middleware

Zephyr uses `@lindorm/middleware` for composable request/response transformations. Middleware runs before every `emit`, `request`, and incoming event handler.

```typescript
import { Zephyr, ZephyrMiddleware } from "@lindorm/zephyr";

const loggingMiddleware: ZephyrMiddleware = async (ctx, next) => {
  console.log(`Event: ${ctx.event}`, ctx.outgoing.data);
  await next();
  console.log(`Response:`, ctx.incoming.data);
};

const authMiddleware: ZephyrMiddleware = async (ctx, next) => {
  ctx.outgoing.headers["x-session-id"] = getSessionId();
  await next();
};

const client = new Zephyr({
  url: "https://api.example.com",
  middleware: [loggingMiddleware, authMiddleware],
});
```

**Middleware context (`ZephyrContext`):**

| Field      | Type              | Description                                            |
| ---------- | ----------------- | ------------------------------------------------------ |
| `app`      | `AppContext`      | App metadata (alias, url, environment)                 |
| `event`    | `string`          | Event name                                             |
| `logger`   | `ILogger`         | Logger instance (if configured)                        |
| `metadata` | `MetadataContext` | Auto-generated `correlationId` and `requestId` (UUIDs) |
| `incoming` | `IncomingContext` | Response data and status                               |
| `outgoing` | `OutgoingContext` | Request data and headers                               |

### Rooms

Rooms provide namespace-scoped communication. Events are automatically prefixed with `rooms:{name}:` to match the server-side convention.

```typescript
const lobby = client.room("lobby");
await lobby.join();

lobby.on("message", (data) => {
  console.log("Lobby message:", data);
});

await lobby.emit("message", { text: "Hello everyone!" });
await lobby.leave();
```

## Connection Management

### Authentication

Zephyr uses pluggable **auth strategies** to handle different authentication flows. Each strategy implements `ZephyrAuthStrategy`, which prepares the socket handshake and handles credential refresh.

```typescript
import {
  createBearerAuthStrategy,
  createDpopBearerAuthStrategy,
  createCookieAuthStrategy,
  Zephyr,
} from "@lindorm/zephyr";
```

#### Bearer Auth

For applications that authenticate with bearer tokens (e.g. OAuth2 access tokens):

```typescript
const client = new Zephyr({
  url: "https://api.example.com",
  auth: createBearerAuthStrategy({
    getBearerCredentials: async () => ({
      bearer: authContext.accessToken,
      expiresIn: authContext.expiresIn,
    }),
  }),
});
```

`getBearerCredentials` is called at connect time, on every reconnect attempt, and on each `refresh()` call. It must return the current bearer token and its remaining lifetime in seconds.

**Options (`BearerAuthStrategyOptions`):**

| Option                 | Type                                                    | Required | Description                                      |
| ---------------------- | ------------------------------------------------------- | -------- | ------------------------------------------------ |
| `getBearerCredentials` | `() => BearerCredentials \| Promise<BearerCredentials>` | Yes      | Returns `{ bearer, expiresIn }`                  |
| `refreshAckTimeoutMs`  | `number`                                                | No       | Server ack timeout for refresh (default: 5000ms) |

#### DPoP Bearer Auth

For DPoP-bound tokens (RFC 9449). Sends a DPoP proof JWT in a header alongside the bearer token:

```typescript
const client = new Zephyr({
  url: "https://api.example.com",
  auth: createDpopBearerAuthStrategy({
    getBearerCredentials: async () => ({
      bearer: authContext.accessToken,
      expiresIn: authContext.expiresIn,
    }),
    privateKey: dpopKeyPair.privateKey,
    publicJwk: dpopKeyPair.publicJwk,
  }),
});
```

The DPoP proof is generated automatically using the Web Crypto API and injected as a `DPoP` header on the handshake request.

**Options (`DpopBearerAuthStrategyOptions`):**

| Option                 | Type                                                    | Required | Description                                      |
| ---------------------- | ------------------------------------------------------- | -------- | ------------------------------------------------ |
| `getBearerCredentials` | `() => BearerCredentials \| Promise<BearerCredentials>` | Yes      | Returns `{ bearer, expiresIn }`                  |
| `privateKey`           | `CryptoKey`                                             | Yes      | DPoP signing key (Web Crypto)                    |
| `publicJwk`            | `JsonWebKey`                                            | Yes      | Public JWK for proof header                      |
| `refreshAckTimeoutMs`  | `number`                                                | No       | Server ack timeout for refresh (default: 5000ms) |

#### Cookie Auth

For browser applications that rely on HTTP-only session cookies. The browser sends cookies automatically; the strategy calls an HTTP endpoint to extend the session before notifying the socket:

```typescript
const client = new Zephyr({
  url: "https://api.example.com",
  auth: createCookieAuthStrategy({
    refreshUrl: "https://api.example.com/auth/refresh",
  }),
  socketOptions: { withCredentials: true },
});
```

On `refresh()`, the strategy issues a `POST` request to `refreshUrl` with `credentials: "include"`, then emits a refresh event to the socket.

**Options (`CookieAuthStrategyOptions`):**

| Option                | Type          | Required | Description                                       |
| --------------------- | ------------- | -------- | ------------------------------------------------- |
| `refreshUrl`          | `string`      | Yes      | HTTP endpoint that extends/refreshes the session  |
| `refreshFetchInit`    | `RequestInit` | No       | Custom fetch options merged into the refresh call |
| `refreshAckTimeoutMs` | `number`      | No       | Server ack timeout for refresh (default: 5000ms)  |

#### Known Limitations

- Cookie mode requires the pylon server to have an explicit CORS allowlist (not `"*"`).
- DPoP proof is verified once at handshake; key rotation requires reconnect.
- Session invalidation is detected at refresh time, not instantly.

### Auth Refresh

Zephyr provides built-in support for refreshing credentials on a live connection.

**`client.refresh()`** -- manually triggers a credential refresh. The call is internally debounced so concurrent callers share a single in-flight refresh. Returns a promise that resolves when the server acknowledges the new credentials.

```typescript
await client.refresh();
```

**`client.onAuthExpired(handler)`** -- registers a handler for server-sent `$pylon/auth/expired` events. Returns an unsubscribe function.

```typescript
const unsubscribe = client.onAuthExpired((event) => {
  console.log("Auth expired", event.reason);
});

// Later
unsubscribe();
```

**`autoRefreshOnExpiry`** -- when `true` (the default), the client automatically calls `refresh()` whenever a `$pylon/auth/expired` event is received from the server. Set to `false` if you want full manual control.

```typescript
const client = new Zephyr({
  url: "https://api.example.com",
  auth: createBearerAuthStrategy({
    /* ... */
  }),
  autoRefreshOnExpiry: false,
});

client.onAuthExpired(async () => {
  await renewTokens();
  await client.refresh();
});
```

### Lifecycle Handlers

```typescript
client.onConnect(() => {
  console.log("Connected:", client.id);
});

client.onDisconnect((reason) => {
  console.log("Disconnected:", reason);
});

client.onError((error) => {
  console.error("Socket error:", error);
});

client.onReconnect((attempt) => {
  console.log("Reconnected after", attempt, "attempts");
});
```

### Auto-Connect

By default, you call `connect()` explicitly. Set `autoConnect: true` to connect on instantiation:

```typescript
const client = new Zephyr({
  url: "https://api.example.com",
  autoConnect: true,
});
// Already connecting...
```

Event listeners registered before the connection completes are queued and applied once connected.

## Events

### Emit (Fire-and-Forget)

Send an event without waiting for a response:

```typescript
await client.emit("analytics:track", { event: "click", target: "buy-button" });
```

The payload is wrapped in a [Pylon envelope](#wire-protocol) with headers and metadata before transmission.

### Request (Acknowledgement)

Send an event and await a typed response via Socket.IO acknowledgements:

```typescript
const result = await client.request("users:list", { page: 1 });
// result contains the server's response data

// With custom timeout
const result = await client.request(
  "reports:generate",
  { type: "monthly" },
  { timeout: 30000 },
);
```

The default timeout is **5000ms**, configurable per-client or per-request. If the server responds with a `nack` (error acknowledgement), a `ZephyrError` is thrown.

### Listeners

Register event listeners for incoming server events:

```typescript
// Persistent listener
client.on("notifications:new", (data) => {
  showNotification(data);
});

// One-time listener
client.once("welcome", (data) => {
  console.log("Welcome message:", data.text);
});

// Remove a specific listener
client.off("notifications:new", myHandler);

// Remove all listeners for an event
client.off("notifications:new");
```

## Room Management

The `ZephyrRoom` class wraps room-scoped communication with automatic event namespacing:

```typescript
const room = client.room("game-lobby");

// Join/leave sends namespaced requests to the server
await room.join(); // sends request("rooms:game-lobby:join")
await room.leave(); // sends request("rooms:game-lobby:leave")

// Events are automatically prefixed
await room.emit("move", { x: 10, y: 20 });
// emits "rooms:game-lobby:move"

room.on("player-joined", (data) => {
  // Listens to "rooms:game-lobby:player-joined"
});

room.off("player-joined");
```

**Room properties and methods:**

| Member    | Type                                      | Description                         |
| --------- | ----------------------------------------- | ----------------------------------- |
| `name`    | `string`                                  | Room name (readonly)                |
| `join()`  | `Promise<void>`                           | Join the room via server request    |
| `leave()` | `Promise<void>`                           | Leave the room via server request   |
| `emit()`  | `(event: string, data?) => Promise<void>` | Emit a room-scoped event            |
| `on()`    | `(event: string, handler) => void`        | Listen to a room-scoped event       |
| `off()`   | `(event: string, handler?) => void`       | Remove a room-scoped event listener |

## Wire Protocol

Zephyr wraps all payloads in a **Pylon envelope** for interoperability with `@lindorm/pylon` servers:

**Outgoing envelope:**

```typescript
{
  __pylon: true,
  header: {
    correlationId: "uuid",
    requestId: "uuid",
    // ...custom headers from middleware
  },
  payload: { /* your data */ }
}
```

**Acknowledgement responses:**

```typescript
// Success
{ __pylon: true, ok: true, data: { /* response */ } }

// Error
{ __pylon: true, ok: false, error: { code: "NOT_FOUND", message: "User not found" } }
```

Error acknowledgements are automatically unwrapped and thrown as `ZephyrError` instances.

## React Auth Bridge

When using Zephyr with React, the auth strategy's `getBearerCredentials` callback is captured once at client creation time. If it closes over a React state value (e.g. `auth.accessToken`), it will read a stale snapshot after re-renders. Use a **ref** to ensure the callback always reads the latest token:

```tsx
import { FC, ReactNode, useEffect, useMemo, useRef } from "react";
import { Zephyr } from "@lindorm/zephyr";
import { createBearerAuthStrategy } from "@lindorm/zephyr";
import { ZephyrProvider } from "@lindorm/zephyr/react";

const ZephyrBridge: FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const tokenRef = useRef(auth.accessToken);
  tokenRef.current = auth.accessToken;

  const client = useMemo(
    () =>
      new Zephyr({
        url: "https://api.example.com",
        auth: createBearerAuthStrategy({
          getBearerCredentials: () => ({
            bearer: tokenRef.current,
            expiresIn: auth.expiresIn,
          }),
        }),
      }),
    [],
  );

  useEffect(() => {
    return client.onAuthExpired(async () => {
      await auth.refresh();
      await client.refresh();
    });
  }, [auth, client]);

  return <ZephyrProvider client={client}>{children}</ZephyrProvider>;
};
```

The `tokenRef` is mutated on every render so `getBearerCredentials` always returns the current access token, even though the `Zephyr` instance is created only once via `useMemo`. Without the ref, reconnect and refresh flows would send an expired token captured in the initial closure.

## React Integration

Import hooks and the provider from `@lindorm/zephyr/react`:

```typescript
import {
  ZephyrProvider,
  useZephyr,
  useRequest,
  useEvent,
  useRoom,
} from "@lindorm/zephyr/react";
```

### ZephyrProvider

Wraps your component tree with a Zephyr client instance:

```tsx
import { Zephyr } from "@lindorm/zephyr";
import { ZephyrProvider } from "@lindorm/zephyr/react";

const client = new Zephyr({ url: "https://api.example.com" });

const App = () => (
  <ZephyrProvider client={client}>
    <MyApp />
  </ZephyrProvider>
);
```

### useZephyr

Access the Zephyr client instance from context:

```tsx
import { useZephyr } from "@lindorm/zephyr/react";

const ChatInput = () => {
  const zephyr = useZephyr();

  const send = async (text: string) => {
    await zephyr.emit("chat:message", { text });
  };

  return <input onKeyDown={(e) => e.key === "Enter" && send(e.currentTarget.value)} />;
};
```

### useRequest

Declarative data fetching via socket request/response:

```tsx
import { useRequest } from "@lindorm/zephyr/react";

const UserList = () => {
  const { data, error, loading, refetch } = useRequest("users:list", { page: 1 });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <ul>
        {data?.users.map((u) => (
          <li key={u.id}>{u.name}</li>
        ))}
      </ul>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
};
```

**Options:**

| Option    | Type      | Default | Description                      |
| --------- | --------- | ------- | -------------------------------- |
| `timeout` | `number`  | `5000`  | Request timeout in milliseconds  |
| `enabled` | `boolean` | `true`  | Set `false` to defer the request |

**Return value:**

| Field     | Type                       | Description                    |
| --------- | -------------------------- | ------------------------------ |
| `data`    | `T \| undefined`           | Response data                  |
| `error`   | `ZephyrError \| undefined` | Error, if the request failed   |
| `loading` | `boolean`                  | Whether a request is in-flight |
| `refetch` | `() => Promise<void>`      | Re-run the request             |

The hook re-fetches automatically when `data` or `enabled` changes (using JSON-serialized dependency tracking).

### useEvent

Subscribe to incoming events with automatic cleanup:

```tsx
import { useEvent } from "@lindorm/zephyr/react";

const Notifications = () => {
  const [messages, setMessages] = useState<string[]>([]);

  useEvent("notifications:new", (data) => {
    setMessages((prev) => [...prev, data.text]);
  });

  return (
    <ul>
      {messages.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
};
```

The handler reference is tracked internally — the listener is cleaned up on unmount.

### useRoom

Join a room on mount, leave on unmount, and access the room instance:

```tsx
import { useRoom } from "@lindorm/zephyr/react";

const GameLobby = () => {
  const room = useRoom("game-lobby");

  const sendMove = async () => {
    await room.emit("move", { x: 10, y: 20 });
  };

  return <button onClick={sendMove}>Move</button>;
};
```

The hook memoizes the room instance and automatically calls `join()` on mount and `leave()` on unmount.

## Testing

Import mock factories from `@lindorm/zephyr/mocks`:

```typescript
import { createMockZephyr, createMockZephyrRoom } from "@lindorm/zephyr/mocks";

const mockClient = createMockZephyr();
const mockRoom = createMockZephyrRoom("lobby");

// All methods are Jest mocks
mockClient.connect.mockResolvedValue(undefined);
mockClient.request.mockResolvedValue({ users: [] });
mockRoom.join.mockResolvedValue(undefined);

// Assert calls
expect(mockClient.emit).toHaveBeenCalledWith("analytics:track", { event: "click" });
expect(mockRoom.join).toHaveBeenCalled();
```

**Available mocks:**

| Factory                  | Returns          | Description                                           |
| ------------------------ | ---------------- | ----------------------------------------------------- |
| `createMockZephyr()`     | `MockZephyr`     | Full `IZephyr` mock with all methods as `jest.fn`     |
| `createMockZephyrRoom()` | `MockZephyrRoom` | Full `IZephyrRoom` mock with all methods as `jest.fn` |

## Configuration Reference

Full type signature of `ZephyrOptions`:

```typescript
type ZephyrOptions = {
  // Required
  url: string;

  // Optional
  alias?: string;
  auth?: ZephyrAuthStrategy;
  autoConnect?: boolean; // default: false
  autoRefreshOnExpiry?: boolean; // default: true
  environment?: Environment;
  logger?: ILogger;
  middleware?: Array<ZephyrMiddleware>;
  namespace?: string;
  socketOptions?: AdvancedOptions;
  timeout?: number; // default: 5000ms
};
```

The `auth` option accepts any `ZephyrAuthStrategy`, created via `createBearerAuthStrategy`, `createDpopBearerAuthStrategy`, or `createCookieAuthStrategy`. See [Authentication](#authentication) for details on each strategy.

## Error Handling

Zephyr uses `ZephyrError` (extending `LindormError` from `@lindorm/errors`) for all error cases:

```typescript
import { ZephyrError } from "@lindorm/zephyr";

try {
  await client.request("protected:resource");
} catch (error) {
  if (error instanceof ZephyrError) {
    console.error(error.message);
  }
}
```

Error sources:

- **Timeout** — request exceeds the configured timeout
- **Nack response** — server responds with `{ ok: false, error: { ... } }`
- **Connection failure** — socket fails to connect or disconnects unexpectedly
- **Auth refresh failure** — server rejects the refresh, ack times out, or (in cookie mode) the HTTP refresh call fails

## License

AGPL-3.0-or-later — see the root [`LICENSE`](https://github.com/lindorm-io/monorepo/blob/main/LICENSE).
