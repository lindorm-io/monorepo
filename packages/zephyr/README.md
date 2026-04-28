# @lindorm/zephyr

Type-safe real-time WebSocket client for Node.js and React, built on [Socket.IO](https://socket.io/). Provides middleware composition, room helpers, request/response semantics over Socket.IO acknowledgements, pluggable auth strategies, and React hooks.

This package is **ESM-only**. All examples use `import` syntax — `require` is not supported.

## Installation

```bash
npm install @lindorm/zephyr
```

Two peer dependencies are optional and only required for specific features:

| Peer              | Required for                                  |
| ----------------- | --------------------------------------------- |
| `@lindorm/logger` | Passing an `ILogger` instance to the client   |
| `react` >=18      | Hooks and provider in `@lindorm/zephyr/react` |

## Subpath exports

| Export                         | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `@lindorm/zephyr`              | Client class, auth strategies, middleware, types, errors           |
| `@lindorm/zephyr/react`        | `ZephyrProvider`, `useZephyr`, `useEvent`, `useRequest`, `useRoom` |
| `@lindorm/zephyr/mocks/jest`   | Jest mock factories for tests                                      |
| `@lindorm/zephyr/mocks/vitest` | Vitest mock factories for tests                                    |

## Quick start

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

await client.emit("analytics:track", { event: "page_view" });

const users = await client.request("users:list", { page: 1 });

client.on("notifications:new", (data) => {
  console.log("New notification:", data);
});
```

## Table of contents

- [Client](#client)
- [Event map typing](#event-map-typing)
- [Middleware](#middleware)
- [Authentication](#authentication)
- [Auth refresh](#auth-refresh)
- [Lifecycle handlers](#lifecycle-handlers)
- [Emit, request, and listeners](#emit-request-and-listeners)
- [Rooms](#rooms)
- [Wire protocol](#wire-protocol)
- [React](#react)
- [Testing](#testing)
- [API reference](#api-reference)
- [Errors](#errors)
- [License](#license)

## Client

The `Zephyr` class wraps a Socket.IO client with middleware, envelope formatting, and typed event handling.

```typescript
import { Zephyr } from "@lindorm/zephyr";

const client = new Zephyr({
  url: "https://api.example.com",
  namespace: "/chat",
  timeout: 10000,
  logger: myLogger,
});
```

The full `ZephyrOptions` shape:

```typescript
type ZephyrOptions = {
  url: string;
  alias?: string;
  auth?: ZephyrAuthStrategy;
  autoConnect?: boolean; // default: false
  autoRefreshOnExpiry?: boolean; // default: true
  environment?: Environment;
  logger?: ILogger;
  middleware?: Array<ZephyrMiddleware>;
  namespace?: string;
  socketOptions?: AdvancedOptions;
  timeout?: number; // default: 5000
};
```

`AdvancedOptions` is a `DeepPartial` of Socket.IO `ManagerOptions` and `SocketOptions`, with `autoConnect`, `timeout`, and `auth` excluded — those are managed by Zephyr itself.

When `autoConnect` is `true`, the client begins connecting in the constructor. Listeners registered via `on`, `once`, `onConnect`, etc. before the underlying socket is created are queued and applied as soon as the socket is wired up.

## Event map typing

Define a `ZephyrEventMap` to get compile-time type safety for outgoing and incoming payloads on each named event.

```typescript
import { Zephyr, type ZephyrEventMap } from "@lindorm/zephyr";

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

const client = new Zephyr<MyEvents>({ url: "https://api.example.com" });

const result = await client.request("users:list", { page: 1 });

client.on("users:created", (data) => {
  // data: { id: string; name: string }
});
```

## Middleware

Zephyr uses `@lindorm/middleware` for composable request/response transformations. The middleware chain runs around every `emit`, `request`, and incoming listener invocation.

```typescript
import { Zephyr, type ZephyrMiddleware } from "@lindorm/zephyr";

const loggingMiddleware: ZephyrMiddleware = async (ctx, next) => {
  console.log("Outgoing:", ctx.event, ctx.outgoing.data);
  await next();
  console.log("Incoming:", ctx.incoming.data);
};

const headerMiddleware: ZephyrMiddleware = async (ctx, next) => {
  ctx.outgoing.header["x-session-id"] = getSessionId();
  await next();
};

const client = new Zephyr({
  url: "https://api.example.com",
  middleware: [loggingMiddleware, headerMiddleware],
});
```

`ZephyrContext` fields:

| Field      | Type                   | Description                                                |
| ---------- | ---------------------- | ---------------------------------------------------------- |
| `app`      | `AppContext`           | `{ alias, url, environment }` snapshot from client options |
| `event`    | `string`               | Event name                                                 |
| `logger`   | `ILogger \| undefined` | Child logger named `Zephyr`, when one was provided         |
| `metadata` | `MetadataContext`      | Auto-generated `correlationId` and `requestId` (UUIDs)     |
| `incoming` | `IncomingContext`      | `{ ok, data }` populated for incoming events / acks        |
| `outgoing` | `OutgoingContext`      | `{ data, header }` for the outgoing wire envelope          |

Built-in middleware:

| Middleware                                           | Description                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `zephyrChangeOutgoingDataMiddleware(mode = "snake")` | Re-keys outgoing data via `@lindorm/case` before send (default: snake_case)  |
| `zephyrChangeIncomingDataMiddleware(mode = "camel")` | Re-keys incoming data via `@lindorm/case` after receipt (default: camelCase) |

```typescript
import {
  Zephyr,
  zephyrChangeIncomingDataMiddleware,
  zephyrChangeOutgoingDataMiddleware,
} from "@lindorm/zephyr";

const client = new Zephyr({
  url: "https://api.example.com",
  middleware: [
    zephyrChangeOutgoingDataMiddleware(),
    zephyrChangeIncomingDataMiddleware(),
  ],
});
```

## Authentication

Auth strategies implement `ZephyrAuthStrategy` (`prepareHandshake(socket)` and `refresh(socket)`). The strategy runs at connect time, on every Socket.IO `reconnect_attempt`, and whenever `client.refresh()` is called or the server emits `$pylon/auth/expired` (when `autoRefreshOnExpiry` is enabled).

```typescript
import {
  createBearerAuthStrategy,
  createCookieAuthStrategy,
  createDpopBearerAuthStrategy,
  Zephyr,
} from "@lindorm/zephyr";
```

### Bearer auth

For applications that authenticate with bearer tokens (e.g. OAuth 2 access tokens). The token is set on `socket.auth` for the handshake; on refresh, the strategy emits `$pylon/auth/refresh` with `{ bearer, expiresIn }` and waits for an ack.

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

| Option                 | Type                                                    | Required | Description                                      |
| ---------------------- | ------------------------------------------------------- | -------- | ------------------------------------------------ |
| `getBearerCredentials` | `() => BearerCredentials \| Promise<BearerCredentials>` | Yes      | Returns `{ bearer, expiresIn }`                  |
| `refreshAckTimeoutMs`  | `number`                                                | No       | Server ack timeout for refresh (default: `5000`) |

### DPoP bearer auth

For DPoP-bound access tokens (RFC 9449). The handshake injects a signed DPoP proof JWT into the `DPoP` extra header alongside the bearer; the proof is signed with the supplied `CryptoKey` using `ECDSA` / `SHA-256` via the Web Crypto API.

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

| Option                 | Type                                                    | Required | Description                                      |
| ---------------------- | ------------------------------------------------------- | -------- | ------------------------------------------------ |
| `getBearerCredentials` | `() => BearerCredentials \| Promise<BearerCredentials>` | Yes      | Returns `{ bearer, expiresIn }`                  |
| `privateKey`           | `CryptoKey`                                             | Yes      | DPoP signing key (Web Crypto)                    |
| `publicJwk`            | `JsonWebKey`                                            | Yes      | Public JWK embedded in the proof header          |
| `refreshAckTimeoutMs`  | `number`                                                | No       | Server ack timeout for refresh (default: `5000`) |

### Cookie auth

For browser apps that authenticate via HTTP-only session cookies. The strategy enables `withCredentials` on the underlying Socket.IO manager so the browser sends cookies on the WebSocket handshake. On `refresh()`, it issues a `POST` to `refreshUrl` with `credentials: "include"`, then emits `$pylon/auth/refresh` to the socket and waits for an ack.

```typescript
const client = new Zephyr({
  url: "https://api.example.com",
  auth: createCookieAuthStrategy({
    refreshUrl: "https://api.example.com/auth/refresh",
  }),
});
```

| Option                | Type          | Required | Description                                                     |
| --------------------- | ------------- | -------- | --------------------------------------------------------------- |
| `refreshUrl`          | `string`      | Yes      | HTTP endpoint that extends or rotates the session cookie        |
| `refreshFetchInit`    | `RequestInit` | No       | Custom `fetch` init merged into (and able to override) the call |
| `refreshAckTimeoutMs` | `number`      | No       | Server ack timeout for refresh (default: `5000`)                |

## Auth refresh

`client.refresh()` triggers the configured strategy's `refresh(socket)` flow. Concurrent calls are deduplicated — the second call awaits the already-in-flight refresh rather than starting a new one. Calling `refresh()` without an `auth` option throws a `ZephyrError`.

```typescript
await client.refresh();
```

`client.onAuthExpired(handler)` registers a handler for server-emitted `$pylon/auth/expired` events. Returns an unsubscribe function. The payload is `{ expiresAt?: number }`.

```typescript
const unsubscribe = client.onAuthExpired((event) => {
  console.log("Auth expired", event.expiresAt);
});

unsubscribe();
```

`autoRefreshOnExpiry` defaults to `true`. When enabled, `$pylon/auth/expired` events trigger `refresh()` automatically. Set to `false` for full manual control:

```typescript
const client = new Zephyr({
  url: "https://api.example.com",
  auth: createBearerAuthStrategy({ getBearerCredentials }),
  autoRefreshOnExpiry: false,
});

client.onAuthExpired(async () => {
  await renewTokens();
  await client.refresh();
});
```

## Lifecycle handlers

```typescript
client.onConnect(() => console.log("Connected:", client.id));
client.onDisconnect((reason) => console.log("Disconnected:", reason));
client.onError((error) => console.error("Socket error:", error));
client.onReconnect((attempt) => console.log("Reconnected after", attempt, "attempts"));
```

If no `onError` handlers are registered and a `logger` is configured, unhandled errors are logged via `logger.error("Unhandled Zephyr error", { error })`.

## Emit, request, and listeners

`emit(event, data?)` sends a fire-and-forget event wrapped in a Pylon envelope. Throws `ZephyrError` if the socket is not connected.

```typescript
await client.emit("analytics:track", { event: "click", target: "buy-button" });
```

`request(event, data?, options?)` sends an event and awaits a typed response via Socket.IO acknowledgement. The default timeout is `5000` ms (configurable per-client via `timeout` and per-call via `options.timeout`). If the server returns a Pylon nack (`{ ok: false, error }`), a `ZephyrError` is thrown carrying the server-supplied `code`, `title`, and `data`.

```typescript
const result = await client.request("users:list", { page: 1 });

const report = await client.request(
  "reports:generate",
  { type: "monthly" },
  { timeout: 30000 },
);
```

Listeners:

```typescript
client.on("notifications:new", (data) => showNotification(data));

client.once("welcome", (data) => console.log("Welcome:", data.text));

client.off("notifications:new", myHandler);

client.off("notifications:new"); // remove all listeners for the event
```

Listeners registered before `connect()` are queued and attached when the socket is created.

## Rooms

`client.room(name)` returns a `ZephyrRoom` whose methods are namespaced with `rooms:{name}:`. The server is expected to recognise `rooms:{name}:join` and `rooms:{name}:leave` request events.

```typescript
const room = client.room("game-lobby");

await room.join(); // request("rooms:game-lobby:join")
await room.leave(); // request("rooms:game-lobby:leave")

await room.emit("move", { x: 10, y: 20 }); // emit "rooms:game-lobby:move"
room.on("player-joined", (data) => {
  /* ... */
}); // on "rooms:game-lobby:player-joined"
room.off("player-joined");
```

| Member    | Type                                                     | Description                       |
| --------- | -------------------------------------------------------- | --------------------------------- |
| `name`    | `string`                                                 | Room name (readonly)              |
| `join()`  | `Promise<void>`                                          | Join the room via server request  |
| `leave()` | `Promise<void>`                                          | Leave the room via server request |
| `emit()`  | `(event: string, data?: any) => Promise<void>`           | Emit a room-scoped event          |
| `on()`    | `(event: string, handler: (data: any) => void) => void`  | Listen to a room-scoped event     |
| `off()`   | `(event: string, handler?: (data: any) => void) => void` | Remove a room-scoped listener     |

## Wire protocol

Zephyr wraps every outgoing payload in a Pylon envelope:

```typescript
{
  __pylon: true,
  header: {
    correlationId: "uuid",
    // ...custom headers added by middleware via ctx.outgoing.header
  },
  payload: { /* your data */ }
}
```

Server acknowledgements use the `PylonAck` shape:

```typescript
// Success
{ __pylon: true, ok: true, data: { /* response */ } }

// Error
{ __pylon: true, ok: false, error: { code?, message?, title?, data? } }
```

Error acks are unwrapped and rethrown as `ZephyrError`. If the ack is a plain (non-Pylon) value, it is treated as the response data directly.

## React

Hooks and the provider are imported from `@lindorm/zephyr/react`.

```typescript
import {
  useEvent,
  useRequest,
  useRoom,
  useZephyr,
  ZephyrProvider,
} from "@lindorm/zephyr/react";
```

### ZephyrProvider

Wraps a subtree with a Zephyr client.

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

Returns the client from context. Throws if used outside a `ZephyrProvider`.

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

Declarative request/response. Re-fetches whenever the JSON-serialised `data` argument or `enabled` flag changes.

```tsx
import { useRequest } from "@lindorm/zephyr/react";

const UserList = () => {
  const { data, error, loading, refetch } = useRequest<{
    users: Array<{ id: string; name: string }>;
  }>("users:list", { page: 1 });

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

| Option    | Type      | Default                 | Description                      |
| --------- | --------- | ----------------------- | -------------------------------- |
| `timeout` | `number`  | client default (`5000`) | Per-call request timeout         |
| `enabled` | `boolean` | `true`                  | Set `false` to defer the request |

| Field     | Type                       | Description                    |
| --------- | -------------------------- | ------------------------------ |
| `data`    | `T \| undefined`           | Response data                  |
| `error`   | `ZephyrError \| undefined` | Error, if the request failed   |
| `loading` | `boolean`                  | Whether a request is in-flight |
| `refetch` | `() => Promise<void>`      | Re-run the request on demand   |

### useEvent

Subscribes to an incoming event. The handler is held in a ref, so re-renders that change the handler do not detach and re-attach the listener; it is removed on unmount.

```tsx
import { useState } from "react";
import { useEvent } from "@lindorm/zephyr/react";

const Notifications = () => {
  const [messages, setMessages] = useState<Array<string>>([]);
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

### useRoom

Memoises a `ZephyrRoom` for the given name, calls `join()` on mount, and `leave()` on unmount.

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

### React auth bridge pattern

The strategy's `getBearerCredentials` callback is captured once when the client is constructed. If it closes directly over a React state value, it will read a stale snapshot after re-renders. Use a ref to ensure the callback always sees the latest token, while the `Zephyr` instance itself is created once via `useMemo`.

```tsx
import { useEffect, useMemo, useRef, type FC, type ReactNode } from "react";
import { createBearerAuthStrategy, Zephyr } from "@lindorm/zephyr";
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

## Testing

Mock factories ship for both Jest and Vitest. They return objects shaped like `IZephyr` / `IZephyrRoom` whose methods are spy functions (`jest.fn()` / `vi.fn()`) preconfigured with sensible default resolutions.

```typescript
// Vitest
import { createMockZephyr, createMockZephyrRoom } from "@lindorm/zephyr/mocks/vitest";

// Jest
import { createMockZephyr, createMockZephyrRoom } from "@lindorm/zephyr/mocks/jest";

const mockClient = createMockZephyr();
const mockRoom = createMockZephyrRoom("lobby");

mockClient.request.mockResolvedValue({ users: [] });

expect(mockClient.emit).toHaveBeenCalledWith("analytics:track", { event: "click" });
expect(mockRoom.join).toHaveBeenCalled();
```

| Factory                       | Returns               | Description                                      |
| ----------------------------- | --------------------- | ------------------------------------------------ |
| `createMockZephyr()`          | `Mocked<IZephyr>`     | Full client mock with spy methods                |
| `createMockZephyrRoom(name?)` | `Mocked<IZephyrRoom>` | Full room mock; defaults `name` to `"mock-room"` |

## API reference

Public exports from `@lindorm/zephyr`:

| Export                                                                      | Kind      | Description                                                |
| --------------------------------------------------------------------------- | --------- | ---------------------------------------------------------- |
| `Zephyr`                                                                    | class     | Main client. `new Zephyr<E>(options)`                      |
| `ZephyrRoom`                                                                | class     | Room helper returned by `client.room(name)`                |
| `ZephyrError`                                                               | class     | Extends `LindormError` from `@lindorm/errors`              |
| `createBearerAuthStrategy`                                                  | function  | Builds a `ZephyrAuthStrategy` for bearer tokens            |
| `createDpopBearerAuthStrategy`                                              | function  | Builds a `ZephyrAuthStrategy` for DPoP-bound tokens        |
| `createCookieAuthStrategy`                                                  | function  | Builds a `ZephyrAuthStrategy` for cookie sessions          |
| `signDpopProof`                                                             | function  | Signs a DPoP proof JWT (`ES256`) — used internally by DPoP |
| `toPublicJwk`                                                               | function  | Returns `{ kty, crv, x, y }` from a JWK                    |
| `zephyrChangeIncomingDataMiddleware`                                        | function  | Re-keys incoming data via `@lindorm/case`                  |
| `zephyrChangeOutgoingDataMiddleware`                                        | function  | Re-keys outgoing data via `@lindorm/case`                  |
| `IZephyr`, `IZephyrRoom`                                                    | types     | Client and room interfaces                                 |
| `AuthExpiredEvent`, `AuthExpiredHandler`                                    | types     | Payload and handler for `$pylon/auth/expired`              |
| `BearerCredentials`                                                         | type      | `{ bearer: string; expiresIn: number }`                    |
| `BearerAuthStrategyOptions`                                                 | type      | Options for `createBearerAuthStrategy`                     |
| `DpopBearerAuthStrategyOptions`                                             | type      | Options for `createDpopBearerAuthStrategy`                 |
| `CookieAuthStrategyOptions`                                                 | type      | Options for `createCookieAuthStrategy`                     |
| `SignDpopProofOptions`                                                      | type      | Options for `signDpopProof`                                |
| `ZephyrAuthStrategy`                                                        | interface | `{ prepareHandshake(socket); refresh(socket) }`            |
| `ZephyrOptions`, `AdvancedOptions`                                          | types     | Client options and Socket.IO subset                        |
| `ZephyrContext`, `ZephyrMiddleware`                                         | types     | Middleware context and signature                           |
| `AppContext`, `MetadataContext`, `IncomingContext`, `OutgoingContext`       | types     | `ZephyrContext` field types                                |
| `ZephyrEventMap`, `ZephyrEventDefinition`, `EventOutgoing`, `EventIncoming` | types     | Typed event-map helpers                                    |
| `PylonEnvelope`, `PylonAck`, `PylonAckOk`, `PylonAckNack`                   | types     | Wire-protocol shapes                                       |

`Zephyr<E>` instance methods:

| Member                            | Signature                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `id`                              | `string \| undefined`                                                           |
| `connected`                       | `boolean`                                                                       |
| `connect()`                       | `Promise<void>`                                                                 |
| `disconnect()`                    | `Promise<void>`                                                                 |
| `refresh()`                       | `Promise<void>` (deduped; throws if no `auth`)                                  |
| `emit(event, data?)`              | `Promise<void>`                                                                 |
| `request(event, data?, options?)` | `Promise<EventIncoming<E, K>>` (`options.timeout` overrides the client default) |
| `on(event, handler)`              | `void`                                                                          |
| `once(event, handler)`            | `void`                                                                          |
| `off(event, handler?)`            | `void`                                                                          |
| `room(name)`                      | `IZephyrRoom`                                                                   |
| `onConnect(handler)`              | `void`                                                                          |
| `onDisconnect(handler)`           | `void` (`handler(reason: string)`)                                              |
| `onError(handler)`                | `void` (`handler(error: ZephyrError)`)                                          |
| `onReconnect(handler)`            | `void` (`handler(attempt: number)`)                                             |
| `onAuthExpired(handler)`          | `() => void` (returns an unsubscribe function)                                  |

## Errors

`ZephyrError` extends `LindormError` from `@lindorm/errors`. It is thrown from:

- `request()` when the server returns a Pylon nack, the ack times out, or the socket is not connected.
- `emit()` when the socket is not connected.
- `connect()` on `connect_error`.
- `refresh()` when no auth strategy is configured, refresh is called before connect, the refresh ack is invalid or times out, or (for cookie auth) the HTTP refresh call fails.

```typescript
import { ZephyrError } from "@lindorm/zephyr";

try {
  await client.request("protected:resource");
} catch (error) {
  if (error instanceof ZephyrError) {
    console.error(error.code, error.message);
  }
}
```

## License

AGPL-3.0-or-later. See the [LICENSE](https://github.com/lindorm-io/monorepo/blob/main/LICENSE) file in the repository root.
