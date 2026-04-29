# @lindorm/monorepo

A TypeScript library ecosystem for building secure, scalable Node.js services — covering cryptography, persistence, messaging, event sourcing, HTTP/WebSocket, and the small utilities that hold them together.

The monorepo is **ESM-only** and targets **Node.js >= 24.13.0**. Every package ships native ESM, native (TC39 stage 3) decorators where applicable, and is published independently to npm under the `@lindorm` scope.

## Disclaimer

This is a monorepo I primarily use to learn new technologies and test ideas. Programming (and especially TypeScript on Node.js) is my special interest — my passion. I hold every package to the highest possible quality standards, because that's how I am as a person. However, there are only so many hours in a day, so while some packages are production ready (forks of pylon, logger, conduit, proteus, and amphora are running in production), not all of them are.

## Highlights

- 🔐 **Cryptography suite** — JOSE tokens (JWT / JWS / JWE), AKP / EC / OKP / RSA / oct signing kits (including post-quantum ML-DSA / FIPS 204), AES, Argon2id passwords, and an Amphora key vault with JWKS + OIDC discovery.
- 🗄️ **One ORM, six drivers** — Proteus models run unchanged against PostgreSQL, MySQL, SQLite, MongoDB, Redis, or an in-memory store, with field-level encryption via Amphora.
- 📨 **One messaging API, five brokers** — Iris speaks memory, RabbitMQ, Kafka, NATS, and Redis Streams behind a single decorator-driven contract.
- 🎯 **Event sourcing & CQRS** — Hermes ties Proteus and Iris together for aggregates, sagas, views, queries, timeouts, GDPR-friendly `@Forgettable()` event-payload encryption, and event-stream checksum verification.
- 🌐 **HTTP & WebSocket** — Pylon for servers (Koa + Socket.IO), Conduit for middleware-based HTTP clients on Axios (retries, circuit breaking, rate limiting, request deduplication, response caching, OAuth2 client credentials, DPoP, Zod validation), and Zephyr for type-safe Socket.IO clients in Node.js and React.
- 🧰 **Production-grade plumbing** — circuit breakers, retry/back-off, interval workers, structured Winston-backed logging, Zod-validated runtime config, and Docker-Compose-aware test orchestration.
- 📦 **Modular & tree-shakeable** — every package is independently published, ESM-only, and shipped with full TypeScript types and TC39 stage-3 decorators where they apply.

## Packages

### Cryptography

| Package                                  | Summary                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`@lindorm/aegis`](./packages/aegis)     | JWT/JWS/JWE/CWT/CWS/CWE token operations backed by an Amphora key store.                    |
| [`@lindorm/aes`](./packages/aes)         | AES encryption helpers built on `@lindorm/kryptos`.                                         |
| [`@lindorm/akp`](./packages/akp)         | Post-quantum signing kit for the ML-DSA family (FIPS 204).                                  |
| [`@lindorm/amphora`](./packages/amphora) | Cryptographic key vault — local Kryptos keys, JWKS endpoint, OIDC discovery.                |
| [`@lindorm/ec`](./packages/ec)           | ECDSA signing kit on top of `@lindorm/kryptos`.                                             |
| [`@lindorm/enigma`](./packages/enigma)   | Argon2id password hashing with optional HMAC + AES layering.                                |
| [`@lindorm/kryptos`](./packages/kryptos) | Generate, import, convert, certify, and dispose JOSE / X.509 keys (EC, OKP, RSA, oct, AKP). |
| [`@lindorm/oct`](./packages/oct)         | HMAC signing kit on top of `@lindorm/kryptos`.                                              |
| [`@lindorm/okp`](./packages/okp)         | EdDSA signing kit on top of `@lindorm/kryptos`.                                             |
| [`@lindorm/pkce`](./packages/pkce)       | PKCE challenge / verifier helpers (RFC 7636).                                               |
| [`@lindorm/rsa`](./packages/rsa)         | RSA signing kit on top of `@lindorm/kryptos`.                                               |
| [`@lindorm/sha`](./packages/sha)         | Typed SHA-1/256/384/512 hashing wrapper.                                                    |

### Persistence & messaging

| Package                                  | Summary                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`@lindorm/proteus`](./packages/proteus) | Multi-driver ORM (PostgreSQL, MySQL, SQLite, MongoDB, Redis, in-memory) with TC39 decorators. |
| [`@lindorm/iris`](./packages/iris)       | Multi-driver messaging (memory, RabbitMQ, Kafka, NATS, Redis Streams) with a single API.      |
| [`@lindorm/hermes`](./packages/hermes)   | CQRS / Event Sourcing framework built on Proteus and Iris.                                    |

### HTTP / WebSocket

| Package                                        | Summary                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`@lindorm/pylon`](./packages/pylon)           | HTTP and WebSocket framework on top of Koa and Socket.IO.                                                     |
| [`@lindorm/conduit`](./packages/conduit)       | Middleware-based HTTP client (Axios) with retries, breakers, OAuth2 client credentials, DPoP, Zod validation. |
| [`@lindorm/zephyr`](./packages/zephyr)         | Type-safe Socket.IO client for Node.js and React.                                                             |
| [`@lindorm/middleware`](./packages/middleware) | Framework-agnostic middleware composition helper (Koa-style).                                                 |
| [`@lindorm/url`](./packages/url)               | Build, validate, and inspect URLs on top of the platform `URL` class.                                         |

### Reliability & runtime

| Package                                  | Summary                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`@lindorm/breaker`](./packages/breaker) | Protocol-agnostic circuit breaker with sliding-window failure tracking.                    |
| [`@lindorm/retry`](./packages/retry)     | Back-off and retry helpers; wrap any async function with automatic retries.                |
| [`@lindorm/worker`](./packages/worker)   | Interval background worker with retry, jitter, lifecycle events, graceful shutdown.        |
| [`@lindorm/logger`](./packages/logger)   | Type-safe Winston wrapper with hierarchical scopes, correlation metadata, and filters.     |
| [`@lindorm/config`](./packages/config)   | Runtime configuration loader — YAML + `.env` + env vars + `NODE_CONFIG`, validated by Zod. |

### Encoding & data

| Package                                    | Summary                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| [`@lindorm/b64`](./packages/b64)           | Base64 / Base64URL encoding helpers.                                      |
| [`@lindorm/json-kit`](./packages/json-kit) | Loss-less JSON serialisation for `Date`, `Buffer`, `BigInt`, `undefined`. |

### Utilities

| Package                                  | Summary                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`@lindorm/case`](./packages/case)       | String case conversion for strings, object keys, and arrays.                              |
| [`@lindorm/date`](./packages/date)       | `date-fns` wrapper with human-readable durations and TTL-aware containers.                |
| [`@lindorm/enums`](./packages/enums)     | Shared TypeScript enums.                                                                  |
| [`@lindorm/errors`](./packages/errors)   | Structured error classes with HTTP status codes and JSON serialisation.                   |
| [`@lindorm/is`](./packages/is)           | Type guards for primitives, objects, URLs, and JOSE tokens.                               |
| [`@lindorm/random`](./packages/random)   | Cryptographically-strong random helpers for ids, numbers, strings, UUIDs.                 |
| [`@lindorm/scanner`](./packages/scanner) | Recursive filesystem scanner with dynamic module imports.                                 |
| [`@lindorm/types`](./packages/types)     | Shared TypeScript types and runtime constants.                                            |
| [`@lindorm/utils`](./packages/utils)     | Grab-bag of small, tree-shakeable helpers (deep diff/merge, abort-signal composition, …). |

### Tooling

| Package                                            | Summary                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`@lindorm/composed`](./packages/composed)         | Run a command with Docker Compose services started up first, torn down on exit. |
| [`@lindorm/create-pylon`](./packages/create-pylon) | Interactive CLI scaffolder for new Pylon applications.                          |
| [`@lindorm/typewriter`](./packages/typewriter)     | Generate TypeScript types or Zod schemas from JSON / YAML samples.              |

## Installation

Pick the packages you need — each is published independently:

```bash
npm install @lindorm/aegis @lindorm/amphora @lindorm/logger
npm install @lindorm/proteus pg
npm install @lindorm/iris kafkajs
npm install @lindorm/pylon
npm install @lindorm/hermes
```

Driver and feature peers (databases, brokers, encryption helpers) are listed in each package's README and only need to be installed for the drivers / features you use.

## Working in the monorepo

### Prerequisites

- Node.js >= 24.13.0
- npm 10+ (workspaces)
- Docker + Docker Compose (only for integration suites in `iris` and `proteus`)

### Setup

```bash
git clone https://github.com/lindorm-io/monorepo.git
cd monorepo
npm install
npm run build
```

### Common scripts

| Script                     | What it does                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run build`            | Build every package via Lerna.                                                            |
| `npm run typecheck`        | Loose typecheck across all packages.                                                      |
| `npm run lint`             | ESLint on `packages/*/src/` plus the cadence-script audit.                                |
| `npm test`                 | Unit suites everywhere, then integration suites under `composed` (boots Docker services). |
| `npm run test:unit`        | Unit suites only (no Docker).                                                             |
| `npm run test:integration` | Integration suites only (boots Docker services).                                          |
| `npm run test:weekly`      | Long-running suites that only run on the weekly schedule.                                 |
| `npm run sync:peers`       | `syncpack lint` — verify peer-dep ranges across packages.                                 |
| `npm run release`          | `lerna publish` (maintainer use).                                                         |

Tests are powered by **Vitest 4** with cadence-driven configs (`unit`, `integration`, `weekly`). Only `iris` and `proteus` ship integration suites — everything else is pure unit tests. Run a single package's tests by `cd packages/<name> && npm test`.

## License

[AGPL-3.0-or-later](./LICENSE).

## Acknowledgments

Built with:

- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- [Lerna](https://lerna.js.org/)
- [Docker](https://www.docker.com/)
