# TCK naming-strategy coverage

The behavioural TCK (`run-tck.ts`) can replay the entire suite under one or more
naming strategies (`none` / `snake` / `camel`) via `runTck(factory, getSource, namings)`.
Each strategy runs in its own `describe` block with a fresh set of entity classes.

## Why one strategy per driver

`applyNamingStrategy` is a **shared, driver-agnostic resolver**. It resolves
entity / column / foreign-key names from metadata **before** any driver renders
DDL or SQL — the same resolver output feeds every driver. Proving a strategy
therefore only has to happen **once**: if `snake` resolves correctly, it resolves
correctly for every driver, because the resolution step is identical across them.

Replaying all three strategies on every driver was pure redundancy. Worse, on
sqlite it was a resource problem: three strategy replays plus a cached replay meant
**four full suite replays in a single worker**, which pushed the run into Node's
heap ceiling and OOM'd. Redistributing to one strategy per driver drops sqlite to
**two replays** (`none` + the cached `none` pass), well under the ceiling, while
keeping full strategy coverage across the driver matrix.

## Strategy → driver map

| Strategy | Driver that proves it                   | Harness file (`__tests__/`)                                                          |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| `none`   | sqlite (+ cached), mongo, redis, memory | `sqlite.tck.test.ts`, `memory.tck.test.ts`, `mongo.tck.test.ts`, `redis.tck.test.ts` |
| `snake`  | postgres                                | `postgres.tck.test.ts`                                                               |
| `camel`  | mysql                                   | `mysql.tck.test.ts`                                                                  |

All three strategies are exercised against a **real** driver rendering **real**
names — `none` on four drivers, `snake` on postgres, `camel` on mysql.

## Test taxonomy

TCK harnesses use the dedicated `*.tck.test.ts` suffix so the three test buckets
fall out of the filename: `*.test.ts` (unit), `*.integration.test.ts`
(integration), `*.tck.test.ts` (per-driver conformance). The `test:tck:<driver>`
scripts run through `vitest.tck.mjs` (which includes only `**/*.tck.test.ts`), so
a bare driver-name filter selects exactly that driver's harness(es): e.g.
`postgres` → `postgres.tck.test.ts` + `postgres-migration.tck.test.ts`, `redis` →
`redis.tck.test.ts` (never `redis-cache-adapter.integration.test.ts`).

## Residual risk

A driver-specific _rendering_ quirk under a strategy that driver is **not**
assigned (e.g. how mysql quotes a `snake`-cased identifier) is **not** covered by
this naming matrix. That surface is covered instead by each driver's own DDL /
quoting / identifier cases (the `renamed-columns`, upsert-naming, and per-driver
`quote-identifier` / `resolve-column-name` unit + integration tests). The naming
matrix proves the shared _resolver_; the per-driver cases prove the _rendering_.
