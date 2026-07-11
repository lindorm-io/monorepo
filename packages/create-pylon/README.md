# @lindorm/create-pylon

Interactive CLI scaffolder for new [Pylon](https://www.npmjs.com/package/@lindorm/pylon) applications.

This package is **ESM-only** and requires **Node.js >= 24.13.0**.

## Usage

```bash
npm create @lindorm/pylon@latest my-app
```

Run without a name to be prompted:

```bash
npm create @lindorm/pylon@latest
```

The scaffolder asks for features and drivers, copies templates into the target directory, generates `proteus` and `iris` source files, installs dependencies with `npm install`, and initialises a git repository with an initial commit.

## Features

- Interactive prompts for project name, issuer URL, HTTP / Socket.IO features, persistence drivers, message bus driver, OIDC authentication, rate limiting, and workers
- Template overlay system that composes a `base` layer with optional `http`, `socket`, `webhooks`, and `workers` overlays
- Generates `@lindorm/proteus` sources and a sample entity when one or more persistence drivers are selected
- Generates an `@lindorm/iris` source, sample message, sample publisher, and sample subscriber when a message bus driver is selected
- Generates a `docker-compose.yml` containing only the services required by the selected drivers
- Generates a per-driver `.env` with reasonable local defaults plus a freshly generated `PYLON_KEK` key encryption key
- Detects collisions with non-empty target directories and prompts before removing them
- Skips `git init` when the target directory is already inside a git working tree
- Programmatic API exposing each scaffold step so the same building blocks can be driven from another tool

## Prompt flow

```
? Project name: my-app
? Issuer URL:                     (this service's identity — becomes the Amphora domain for JWKS; default http://localhost:3000)
? Select features:                (HTTP routes / Socket.IO listeners)
? Persistence store (Proteus DB): (postgres / mysql / mongo / sqlite / memory / none)
? Key-value store (Proteus KV):   (redis / memory / none — rate-limit / session / cache)
? Message bus driver (Iris):      (none / kafka / nats / rabbit / redis)
? Webhooks?                       (only when both a Proteus store and an Iris driver are selected)
? Audit logging?                  (only when both a Proteus store and an Iris driver are selected)
? OIDC authentication?            (selecting "yes" also enables session)
? Rate limiting?                  (only when a key-value store is selected)
? Workers:                        (only when a Proteus store is selected)
```

You pick at most one **db** store and one **kv** store. The db store is the primary Proteus source
(`src/proteus/db/source.ts`) — schema-managed, holds your entities, and backs the kryptos/worker layer. The kv
store (`src/proteus/kv/source.ts` when a db is also picked, otherwise the primary) backs rate limiting,
sessions, and the db query cache. When only one store is picked it is the primary at `src/proteus/db/source.ts`;
`none` is valid for either.

## What gets scaffolded

Generated layout (some files only appear depending on the answers):

- `src/index.ts` — entry file with a `Symbol.metadata` polyfill that calls `pylon.start()`
- `src/logger/index.ts` — shared `Logger` instance from `@lindorm/logger`
- `src/pylon/amphora.ts` — `Amphora` instance from `@lindorm/amphora`
- `src/pylon/config.ts` — typed config loaded with `@lindorm/config`, validated with a `zod` schema generated from the selected drivers
- `src/pylon/pylon.ts` — the `Pylon` instance, wired with the selected features, sources, and workers
- `src/types/context.ts` — typed `ServerHttpContext`, `ServerSocketContext`, `ServerHttpMiddleware`, `ServerSocketMiddleware`, `ServerHandler`, and `ServerSocketHandler` aliases
- `src/routes/v1/example.ts` + `src/features/example/example-handler.ts` — example HTTP route (only when HTTP is selected)
- `src/listeners/ping.ts` + `src/features/ping/ping-handler.ts` — example Socket.IO listener (only when Socket.IO is selected)
- `src/routes/webhooks/` + `src/features/webhooks/` — CRUD routes and handlers for `WebhookSubscription` (only when webhooks are selected)
- `src/workers/<worker>.ts` — one file per selected worker (`amphora-entity-sync`, `expiry-cleanup`, `kryptos-rotation`) plus an `alive.ts` example
- `src/proteus/db/source.ts` (the primary db/kv store, with `entities/` + `migrations/`) — plus `src/proteus/kv/source.ts` when both a db and a kv store are picked — and a sample `SampleEntity`, written by `@lindorm/proteus/scaffold`'s code generator
- `src/__fixtures__/test-ctx.ts` — a project-bound `createTestCtx` helper (only when a db or kv store is picked) wrapping `@lindorm/pylon/mocks/vitest`'s `createTestPylonCtx`; `ctx.db`/`ctx.kv` are stateful in-memory Proteus mocks (writes persist, reads reflect them) so repository round-trips work in tests
- `src/iris/source.ts`, a sample `SampleMessage`, plus a sample publisher and subscriber — written by `@lindorm/iris`'s code generator
- `docker-compose.yml` — only emitted when a selected driver is `postgres`, `mysql`, `mongo`, `redis`, `kafka`, `nats`, or `rabbit`
- `config/{default,development,test,production}.yml` — base config files
- `.env` — environment variables seeded with driver defaults and a freshly generated `PYLON_KEK`
- `lindorm.config.ts` — CLI/scaffold-only config (via `@lindorm/scaffold`'s `defineConfig`) that drives the
  `proteus` / `iris` / `pylon generate` commands' target directories; never imported by the runtime
- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.mjs`, `.gitignore`

## Programmatic API

The CLI's building blocks are exported so the same scaffold can be driven from another tool or test.

```typescript
import { runPrompts, scaffold, initGit } from "@lindorm/create-pylon";
import { installDependencies, installDevDependencies } from "@lindorm/create-pylon";
import { BASE_DEV_DEPENDENCIES, BASE_RUNTIME_DEPENDENCIES } from "@lindorm/create-pylon";
import { buildDependencyList, buildDevDependencyList } from "@lindorm/create-pylon";

const answers = await runPrompts({});

await scaffold(answers);

const runtime = [...BASE_RUNTIME_DEPENDENCIES, ...buildDependencyList(answers)];
const dev = [...BASE_DEV_DEPENDENCIES, ...buildDevDependencyList(answers)];

await installDependencies(answers.projectDir, runtime);
await installDevDependencies(answers.projectDir, dev);
await initGit(answers.projectDir);
```

`runPrompts` accepts an optional positional name and working directory, and returns the same `Answers` shape the CLI consumes. `scaffold` is idempotent on a fresh directory; `resolveExistingCollision` should be called first if the caller cannot guarantee that.

### Prompts

| Export                     | Signature                                                                | Description                                                                                  |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `runPrompts`               | `(input: { positionalName?: string; cwd?: string }) => Promise<Answers>` | Runs the full interactive prompt sequence and returns the resolved answers.                  |
| `resolveExistingCollision` | `(projectDir: string) => Promise<void>`                                  | If `projectDir` exists and is non-empty, prompts to remove it; throws when the user cancels. |

### Scaffold

| Export                   | Signature                                           | Description                                                                                                                                                        |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scaffold`               | `(answers: Answers, kek?: string) => Promise<void>` | Runs the full file-emit pipeline: templates, package.json, env, config, pylon, test-ctx fixture, docker-compose, iris, workers, plus `runProteusInit`.             |
| `copyTemplates`          | `(answers: Answers) => void`                        | Copies the `base`, `http`, `socket`, `webhooks`, and `workers` template overlays based on `answers`.                                                               |
| `writePackageJson`       | `(answers: Answers) => void`                        | Writes `package.json` with the project name and scripts; when the stack needs docker-compose services, `dev` runs through `composed` (up/down around `tsx watch`). |
| `writeEnvFile`           | `(answers: Answers, kek?: string) => void`          | Writes `.env` with `NODE_ENV`, `PYLON_KEK`, and per-driver entries.                                                                                                |
| `buildEnvLines`          | `(answers: Answers, kek?: string) => Array<string>` | Same content as `writeEnvFile` but returned as an array of lines.                                                                                                  |
| `writeConfigFile`        | `(answers: Answers) => void`                        | Writes `src/pylon/config.ts`.                                                                                                                                      |
| `writePylonFile`         | `(answers: Answers) => void`                        | Writes `src/pylon/pylon.ts`.                                                                                                                                       |
| `writeTestCtxFile`       | `(answers: Answers) => void`                        | Writes `src/__fixtures__/test-ctx.ts` (a project-bound `createTestCtx`) when a db or kv store is selected.                                                         |
| `writeDockerCompose`     | `(answers: Answers) => void`                        | Writes `docker-compose.yml` when a selected driver requires container infrastructure.                                                                              |
| `writeWorkerFiles`       | `(answers: Answers) => void`                        | Writes one `src/workers/<key>.ts` per selected worker.                                                                                                             |
| `writeIrisSamples`       | `(answers: Answers) => void`                        | Writes a sample publisher and subscriber under `src/iris/`.                                                                                                        |
| `buildDependencyList`    | `(answers: Answers) => Array<string>`               | Returns the runtime npm packages required by the selected drivers, on top of `BASE_RUNTIME_DEPENDENCIES`.                                                          |
| `buildDevDependencyList` | `(answers: Answers) => Array<string>`               | Returns the additional dev dependencies required by the selected drivers.                                                                                          |

### Install / Git

| Export                   | Signature                                                        | Description                                                                                               |
| ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `installDependencies`    | `(projectDir: string, packages: Array<string>) => Promise<void>` | Runs `npm install --save <packages>` in `projectDir`. No-ops on an empty list.                            |
| `installDevDependencies` | `(projectDir: string, packages: Array<string>) => Promise<void>` | Runs `npm install --save-dev <packages>` in `projectDir`. No-ops on an empty list.                        |
| `initGit`                | `(projectDir: string) => Promise<void>`                          | `git init`, `git add .`, and an initial commit. No-ops if the directory is already inside a working tree. |

### Driver code generation

| Export                           | Signature                                                                     | Description                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `runProteusInit`                 | `(projectDir: string, answers: Pick<Answers, "db" \| "kv">) => Promise<void>` | Calls `@lindorm/proteus/scaffold`'s `writeSource` for the db + kv stores (primary at `src/proteus/db`, kv secondary at `src/proteus/kv`). |
| `runProteusGenerateSampleEntity` | `(projectDir: string) => Promise<void>`                                       | Writes a `SampleEntity` under `src/proteus/db/entities/`.                                                                                 |
| `runIrisInit`                    | `(projectDir: string, driver: IrisDriver) => Promise<void>`                   | Calls `@lindorm/iris`'s `writeSource` with the chosen driver. No-op for `"none"`.                                                         |
| `runIrisGenerateSampleMessage`   | `(projectDir: string) => Promise<void>`                                       | Writes a `SampleMessage` under `src/iris/messages/`.                                                                                      |

### Types and constants

The exported `Answers`, `Features`, `IrisDriver`, `ProteusDriver`, `WorkerKey`, and `EnvEntry` types describe the shape of the prompt result. The exported constants (`BASE_RUNTIME_DEPENDENCIES`, `BASE_DEV_DEPENDENCIES`, `PROTEUS_DRIVER_PACKAGES`, `PROTEUS_DRIVER_DEV_PACKAGES`, `IRIS_DRIVER_PACKAGES`, `IRIS_DRIVER_DEV_PACKAGES`, `PROTEUS_ENV_VARS`, `IRIS_ENV_VARS`, `PROTEUS_DEPENDENT_WORKERS`) describe the package and env mappings used internally by the dependency and env builders.

## Generated project requirements

Some selected drivers require external services. The generated `docker-compose.yml` covers the local case for `postgres`, `mysql`, `mongo`, `redis`, `kafka`, `nats`, and `rabbit`. The `memory` and `sqlite` Proteus drivers and the `none` Iris driver have no external requirements.

The generated project itself targets the same `node >= 24.13.0` engine as this CLI and is also ESM-only.

## License

AGPL-3.0-or-later — see [LICENSE](https://github.com/lindorm-io/monorepo/blob/main/LICENSE).
