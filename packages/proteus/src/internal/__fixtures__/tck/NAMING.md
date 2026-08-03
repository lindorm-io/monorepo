# TCK naming-strategy coverage

The behavioural TCK (`run-tck.ts`) can replay the entire suite under one or more
naming strategies (`none` / `snake` / `camel`) via `runTck(factory, getSource, namings)`.
Each strategy runs in its own `describe` block with a fresh set of entity classes.

## Why the document / key-value drivers replay a renaming strategy

`applyNamingStrategy` is a shared resolver, so proving _it_ once is enough. What
is NOT shared is what each driver then DOES with the resolved names:

- **SQL drivers** compile every key through `resolveColumnName`, so a renamed
  column is addressed correctly by construction.
- **memory / redis** key their rows by entity PROPERTY key and hand criteria
  straight to an in-memory matcher — no resolver at all.
- **mongo** keys its documents by COLUMN name and resolves criteria itself.

Those three each hand-roll the mapping, so a strategy proved on postgres proved
nothing about them. Running them under `none` only ever compared a key to
itself. When `snake` was first replayed on them (2026-08-03) it failed **79
times** across FK writes, FK criteria, join tables, single-table inheritance
collections and relation loading — every one a real defect. They now replay
`none` + `snake`.

## Strategy → driver map

| Strategy | Driver that proves it                  | Harness file (`__tests__/`)                                                            |
| -------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `none`   | sqlite (+ cached), and all three below | `sqlite.tck.test.ts`                                                                   |
| `snake`  | postgres, memory, mongo, redis         | `postgres.tck.test.ts`, `memory.tck.test.ts`, `mongo.tck.test.ts`, `redis.tck.test.ts` |
| `camel`  | mysql                                  | `mysql.tck.test.ts`                                                                    |

sqlite stays single-strategy on purpose: it already carries a second full replay
(the cached pass), and three replays in one worker pushed the run into Node's
heap ceiling.

⚠ A replay **doubles** a harness's case count — sanity-check the new total after
adding one.

## Test taxonomy

TCK harnesses use the dedicated `*.tck.test.ts` suffix so the three test buckets
fall out of the filename: `*.test.ts` (unit), `*.integration.test.ts`
(integration), `*.tck.test.ts` (per-driver conformance). The `test:tck:<driver>`
scripts run through `vitest.tck.mjs` (which includes only `**/*.tck.test.ts`), so
a bare driver-name filter selects exactly that driver's harness(es): e.g.
`postgres` → `postgres.tck.test.ts` + `postgres-migration.tck.test.ts`, `redis` →
`redis.tck.test.ts` (never `redis-cache-adapter.integration.test.ts`).

## Residual risk

The TCK entities all carry an explicit `@Entity({ name })`, which the strategy
preserves verbatim — so the matrix exercises renamed COLUMNS, never renamed
TABLE/collection names. Table-name resolution is covered by the per-driver DDL /
naming cases instead.

A driver-specific _rendering_ quirk under a strategy that driver is **not**
assigned (e.g. how mysql quotes a `snake`-cased identifier) is likewise not
covered here; that surface belongs to each driver's own DDL / quoting /
identifier cases (`renamed-columns`, upsert-naming, per-driver
`quote-identifier` / `resolve-column-name` unit + integration tests).
