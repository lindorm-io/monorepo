# Smoke test

The `@lindorm/create-pylon` unit test suite covers every scaffold write path and CLI orchestration step — 87 tests, 65 snapshots — but it doesn't verify that the generated project actually compiles against the real `@lindorm/*` packages. This is the canonical manual check before a release.

## Recipe

The monorepo has npm workspaces configured at root (`"workspaces": ["packages/*"]` in the root `package.json`). **If the scaffolded project lives at `packages/<name>/`, npm install resolves `@lindorm/*` dependencies to local workspace symlinks** — zero registry hit, zero publish required, real local code.

```bash
# 1. Build create-pylon
cd /Users/jonn/Projects/lindorm-monorepo/packages/create-pylon
npm run build

# 2. Scaffold INTO the workspace glob (picks a representative combo)
#    cd into packages/ so the project is created at packages/pylon-smoke,
#    matching the workspaces "packages/*" glob. If you cd into the repo
#    root instead, the project lands at <root>/pylon-smoke (outside the
#    workspace) and npm install pulls from the registry — defeating the
#    smoke test's purpose.
cd /Users/jonn/Projects/lindorm-monorepo/packages
node ./create-pylon/dist/cli.js pylon-smoke

# → answer prompts. A typical "flex everything" combo:
#   features:     HTTP routes ✓ Socket.IO listeners ✓
#   proteus:      postgres
#   iris:         redis
#   webhooks:     yes
#   audit:        yes
#   workers:      all four

# 3. Verify the generated project compiles
cd pylon-smoke
npx tsc --noEmit
echo "exit=$?"   # must be 0

# 4. Clean up
cd /Users/jonn/Projects/lindorm-monorepo
rm -rf packages/pylon-smoke
npm install   # restores root node_modules after the scratch scaffold
```

## Non-interactive variant

For scripted smoke tests (CI, batch runs across combos), bypass the prompts by calling `scaffold(answers)` directly:

```js
// .scratch/smoke.mjs
import { scaffold } from "/Users/jonn/Projects/lindorm-monorepo/packages/create-pylon/dist/index.js";
import {
  installDependencies,
  installDevDependencies,
} from "/Users/jonn/Projects/lindorm-monorepo/packages/create-pylon/dist/install.js";
import {
  runIrisGenerateSampleMessage,
  runIrisInit,
  runProteusGenerateSampleEntity,
  runProteusInit,
} from "/Users/jonn/Projects/lindorm-monorepo/packages/create-pylon/dist/drivers.js";
import { resolve } from "path";
import { existsSync, rmSync } from "fs";

const projectDir = resolve("/Users/jonn/Projects/lindorm-monorepo/packages/pylon-smoke");
if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });

const answers = {
  projectName: "pylon-smoke",
  projectDir,
  features: { http: true, socket: true, webhooks: true, audit: true },
  proteusDriver: "postgres",
  irisDriver: "redis",
  workers: ["amphora-entity-sync", "expiry-cleanup", "kryptos-rotation"],
};

await scaffold(answers);
await installDependencies(projectDir, [
  "@lindorm/pylon",
  "@lindorm/amphora",
  "@lindorm/logger",
  "@lindorm/types",
  "@lindorm/config",
  "zod",
  "@lindorm/proteus",
  "pg",
  "@lindorm/iris",
  "ioredis",
]);
await installDevDependencies(projectDir, [
  "@lindorm/worker",
  "@types/node",
  "@types/jest",
  "@types/pg",
  "jest",
  "ts-jest",
  "tsx",
  "typescript",
]);
await runProteusInit(projectDir, "postgres");
await runProteusGenerateSampleEntity(projectDir);
await runIrisInit(projectDir, "redis");
await runIrisGenerateSampleMessage(projectDir);
```

Run via `node .scratch/smoke.mjs`, then `cd packages/pylon-smoke && npx tsc --noEmit`.

## Why inside the workspace

If you scaffold to `/tmp` or anywhere outside `packages/`, npm will pull `@lindorm/*` packages from the npm registry instead of symlinking local workspace copies. That defeats the purpose — the smoke test becomes dependent on what's been published, not on what's in your working tree. Always scaffold into a `packages/<name>/` directory.

## Combos worth rotating through

No single scaffold exercises every branch. Rotate these over releases:

| Combo                                                    | Why                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| HTTP only, no drivers, no workers                        | Minimal — catches regressions in the base template                           |
| Socket only, no proteus, no iris                         | Socket-only service with just `/health` exposed                              |
| HTTP + postgres + redis + webhooks + audit + all workers | Everything on — maximum branch coverage                                      |
| HTTP + mongo + kafka                                     | Rotates the docker-compose assembly for non-postgres/non-redis               |
| HTTP + sqlite + nats                                     | Exercises sqlite (no container) + nats (container)                           |
| Any combo with proteus=memory                            | Proteus `memory` driver has no connection URL — catches config assembly bugs |

## What "pass" means

- Scaffold writes all expected files (no write errors)
- `npm install` resolves without ERESOLVE
- `proteus init` / `proteus generate entity` / `iris init` / `iris generate message` exit 0 and write their expected files
- `npx tsc --noEmit` exits 0 with no TypeScript diagnostics

If any step fails, open the generated file that triggered it and diagnose — most frequent failure modes are template import paths, tsconfig option drift, and zod/peer-dependency version conflicts with newly-published `@lindorm/*` packages.

## What this does NOT verify

- Runtime behaviour — the scaffold never runs `pylon.start()`. That requires live Postgres / Redis / Kafka / etc. and is out of scope for a scaffold compile check.
- Webhooks or audit actually working end-to-end.
- Generated tests pass (`npm test` inside the scaffolded project).

Those are integration concerns for a full stage environment, not a pre-release scaffold check.
