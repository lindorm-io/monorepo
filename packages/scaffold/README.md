# @lindorm/scaffold

Scaffold-only config layer shared by the proteus, iris and pylon CLIs and `@lindorm/create-pylon`.

> Never import this from application runtime. It exists to resolve where generated files go — CLI/scaffold tooling only.

## `lindorm.config.{ts,mjs}`

Projects describe their scaffold target directories in a `lindorm.config.ts` (or `.mjs`) at the project root:

```ts
import { defineConfig } from "@lindorm/scaffold";

export default defineConfig({
  proteus: { entitiesDir: "./src/proteus/entities" },
  iris: { messagesDir: "./src/iris/messages" },
  pylon: { routesDir: "./src/routes" },
});
```

`defineConfig` is an identity helper — it only exists for editor type inference.

## `loadLindormConfig`

```ts
const config = await loadLindormConfig({ cwd, path });
```

Resolution:

1. explicit `path` — throws `config_file_not_found` when it does not exist.
2. otherwise `lindorm.config.ts`, then `lindorm.config.mjs`, in `cwd`.
3. neither present — returns `null` (callers fall through to defaults).

The default (or named `config`) export must be an object, else it throws `invalid_config_export`.

## `resolveTarget`

`arg > config > default > throw`:

```ts
const dir = resolveTarget({
  arg: argv.dir,
  config: config?.proteus?.entitiesDir,
  default: LINDORM_CONFIG_DEFAULTS.proteus.entitiesDir,
});
```

Throws `target_unresolved` when all three are undefined.

## Dependencies

Loads `.ts`/`.mjs` config through `@lindorm/scanner` (the ecosystem's native→tsx lazy loader) — no jiti/tsx dependency of its own.
