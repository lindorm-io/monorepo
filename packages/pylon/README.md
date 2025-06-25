# @lindorm/pylon

Full-stack **HTTP + WebSocket application framework** designed for Node.js projects that value
strict typing, modularity and security.  It builds on top of
[koa](https://koajs.com/) (HTTP) and [socket.io](https://socket.io/) but hides most of the
boilerplate behind a cohesive, testable API that plays nicely with the rest of the Lindorm
ecosystem (logger, middleware, repositories …).

---

## Highlights

* Unified **context object** shared across HTTP & WS handlers (logger, sources, user, …)
* Pluggable **middleware** pipeline – reuse the same composition helper as
  `@lindorm/middleware`
* Built-in **routing** with type-safe path parameters and automatic body parsing (JSON, form-data)
* Opinionated but flexible **error handling** – wraps thrown errors into consistent HTTP responses
* **Environment aware**: dev mode auto-loads `.env`, production enables built-in security headers
* Powerful **worker** abstraction for cron-style background jobs with retry logic

---

## Installation

```bash
npm install @lindorm/pylon
# or
yarn add @lindorm/pylon
```

You will likely also want `@lindorm/logger`, `@lindorm/middleware` and a datasource driver.

---

## Quick HTTP example

```ts
import { Pylon } from '@lindorm/pylon';
import { Logger } from '@lindorm/logger';

const app = new Pylon({
  port: 4000,
  logger: new Logger({ readable: true }),
});

await app.listen();
```

### Error handling

Throw any `LindormError` inside a route / middleware and Pylon will convert it into a JSON response
with proper status code and `application/problem+json` media-type.

```ts
import { LindormError, PylonRouter } from '@lindorm/errors';

const router = new PylonRouter()

router.get('/secure', async (ctx) => {
  if (!ctx.session) throw new LindormError('Not authenticated', { status: 401 });
});
```

---

## Architecture overview

```
┌──────────────────────────────────────────────────────┐
│                       Pylon                          │
│ ┌──────────┐   ┌────────────────┐  ┌──────────────┐  │
│ │  Router  │─► │ Middleware     │▶ │  Context     │  │
│ │ (HTTP)   │   │ Composition    │  │  (request)   │  │
│ └──────────┘   └────────────────┘  └──────────────┘  │
│        ▲                 ▲               ▲           │
│        │                 │               │           │
│        │         ┌───────┴───────┐       │           │
│        │         │   Sources     │◄──────┘           │
│        │         │ (mongo, etc.) │                   │
│        ▼         └───────────────┘                   │
│ ┌──────────┐                                         │
│ │  PylonIo │  (socket.io gateway)                    │
│ └──────────┘                                         │
└──────────────────────────────────────────────────────┘
```

---

## Testing

Pylon ships with extensive Jest test utilities and 100% unit-test coverage.  The framework is
agnostic regarding database choice – swap real drivers with `@lindorm/mnemos` in tests.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

