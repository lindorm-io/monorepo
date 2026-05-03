# @lindorm/config

Type-safe runtime configuration loader that merges YAML files, `.env` files, process environment, and `NODE_CONFIG`, then validates the result with a Zod schema.

## Installation

```bash
npm install @lindorm/config
```

This package is ESM-only. Import it with `import`; `require()` is not supported.

## Features

- Validates the merged configuration with a Zod schema you supply.
- Loads YAML files from a `config/` directory via the [`config`](https://www.npmjs.com/package/config) (node-config) package, layered by `NODE_ENV`.
- Loads `.env` and `.env.${NODE_ENV}` via [`@dotenvx/dotenvx`](https://www.npmjs.com/package/@dotenvx/dotenvx).
- **Schema-driven** environment-variable override: every leaf in the schema is checked against an env var named `SEGMENT__SEGMENT__LEAF`, regardless of whether YAML scaffolds the key. A service can run with no YAML at all if every required key is in env.
- Accepts a full configuration object as JSON in the `NODE_CONFIG` environment variable.
- Coerces string inputs to the schema's primitive types (numbers, booleans, dates, bigints) and parses JSON-encoded arrays and objects.
- Resolves the running package's `name` and `version` and exposes them as `config.npm.package`.
- Ships a `config` CLI for converting a local `.node_config` file into a `NODE_CONFIG` env string.

## Quick start

```typescript
import { configuration } from "@lindorm/config";
import { z } from "zod";

export const config = configuration(
  {
    server: z.object({
      port: z.number().default(3000),
      host: z.string().default("localhost"),
    }),
    database: z.object({
      url: z.string(),
      poolSize: z.number().default(10),
    }),
    features: z.array(z.string()).default([]),
    isProduction: z.boolean().default(false),
  },
  { scope: import.meta.url },
);

console.log(config.server.port); // number
console.log(config.database.url); // string
console.log(config.npm.package.name); // resolved from the nearest package.json
```

## Configuration sources

`configuration(schema, options?)` runs once at call time and resolves values in this order — later sources override earlier ones for the same key:

1. `.env` and `.env.${NODE_ENV}` files (loaded into `process.env` via `@dotenvx/dotenvx`).
2. YAML files in `./config/` (loaded by the `config` npm package; see its docs for the full list of supported file types and search paths). Keys are normalised to `camelCase`.
3. `NODE_CONFIG` — a JSON object passed in a single environment variable.
4. `process.env` entries derived from the schema's leaves: each leaf path is converted to `CONSTANT_CASE` per segment, joined with `__` (double underscore). Arrays are replaced (not concatenated).

The merged object is then coerced and validated against the Zod schema.

### YAML files

Place files in a `config/` directory at the process working directory. Keys may be written in `snake_case` or `camelCase`; both are normalised to `camelCase`.

```yaml
# config/default.yml
server:
  port: 3000
  host: localhost

database:
  url: postgresql://localhost/myapp
  pool_size: 10

features:
  - feature1
  - feature2

is_production: false
```

```yaml
# config/production.yml
server:
  port: 8080
  host: 0.0.0.0

database:
  pool_size: 50

is_production: true
```

### Environment variables

The env-var name for a schema leaf is built segment-by-segment: each path segment becomes `CONSTANT_CASE` (so `maxRetries` ↔ `MAX_RETRIES`), and segments are joined with `__` (double underscore). The double underscore keeps the segment boundary unambiguous when a segment itself contains internal word breaks.

| Schema key              | Environment variable       |
| ----------------------- | -------------------------- |
| `server.port`           | `SERVER__PORT`             |
| `database.poolSize`     | `DATABASE__POOL_SIZE`      |
| `nested.some.deepValue` | `NESTED__SOME__DEEP_VALUE` |
| `pylon.kek`             | `PYLON__KEK`               |

Binding is **schema-driven** — every leaf in your Zod schema is looked up in `process.env`. You don't need a YAML scaffold for env vars to work; if the env supplies every required key, you can run without `config/*.yml` at all.

Values are passed through `safelyParse` from `@lindorm/utils`, so JSON-encoded arrays and objects are decoded automatically. Empty-string env values (`MY_VAR=""`) are preserved — they are not treated as "unset". Arrays from env replace (not concatenate) any earlier value:

```bash
SERVER__PORT=8080
DATABASE__URL=postgresql://prod-server/myapp
DATABASE__POOL_SIZE=50
FEATURES='["feature1","feature2","feature3"]'
IS_PRODUCTION=true
```

### `.env` files

`@dotenvx/dotenvx` is invoked at the start of `configuration()` and loads, in order:

- `.env.${NODE_ENV}` (only when `NODE_ENV` is set)
- `.env`

The values become part of `process.env` and follow the same `__`-separator binding rules as above.

### `NODE_CONFIG`

`NODE_CONFIG` must be a JSON object — the string has to start with `{` and end with `}`, otherwise `configuration()` throws. Anything declared here overrides everything else.

```bash
NODE_CONFIG='{"server":{"port":9000},"features":["feat1","feat2"]}'
```

## Type coercion

Before validation the schema is rewritten so primitive leaves use Zod's coercing variants. Arrays and objects are walked recursively, and `optional`, `nullable`, and `default` wrappers are preserved.

| Zod type        | Coerced via                    |
| --------------- | ------------------------------ |
| `z.string()`    | `z.coerce.string()`            |
| `z.number()`    | `z.coerce.number()`            |
| `z.boolean()`   | `z.coerce.boolean()`           |
| `z.date()`      | `z.coerce.date()`              |
| `z.bigint()`    | `z.coerce.bigint()`            |
| `z.array(...)`  | recurses into the element type |
| `z.object(...)` | recurses into each property    |

Other Zod types (such as `z.enum`, `z.union`, `z.record`, `z.literal`) are passed through unchanged — values reaching them must already match the expected runtime type. JSON-encoded strings from environment variables are decoded before validation runs, so an array or object env var only needs the surrounding type to be `z.array(...)` or `z.object(...)`.

## NPM identity

`config.npm.package.name` and `config.npm.package.version` are resolved in this order:

1. If `options.scope` is provided, `loadNpmInfo` walks up from that path and reads the nearest `package.json`. Pass `import.meta.url` from your entry file — this is deterministic regardless of `cwd`, including under `node dist/index.js`, Docker `CMD`, systemd, and inside test runners.
2. Otherwise it falls back to the `npm_package_name` / `npm_package_version` environment variables that `npm run` populates.
3. If neither resolves, both fields are empty strings.

```typescript
const config = configuration(schema, { scope: import.meta.url });
```

## CLI

The package installs a `config` binary with a single command:

```
config node_config [-f, --file <file>]
```

It reads `./.node_config` by default and prints a `NODE_CONFIG='...'` line you can paste into your environment. JSON, YAML, and YML files are supported; the extension determines the parser. When `--file` is omitted and `./.node_config` does not exist, the CLI also tries `.node_config.json`, `.node_config.yml`, and `.node_config.yaml` in that order.

```bash
echo '{"server":{"port":9000}}' > .node_config
npx config node_config
# Insert the following into your env:
#
# NODE_CONFIG='{"server":{"port":9000}}'
```

## API

### `configuration(schema, options?)`

```typescript
const configuration: <T extends Record<string, z.ZodType>>(
  schema: T,
  options?: ConfigurationOptions,
) => NpmInformation & z.infer<z.ZodObject<T>>;
```

Loads, merges, coerces, and validates configuration. Throws if `NODE_CONFIG` is not a valid JSON object or if Zod validation fails. The returned object is the parsed schema plus an `npm.package` field.

### `ConfigurationOptions`

```typescript
type ConfigurationOptions = {
  scope?: string;
};
```

`scope` is a path or `file://` URL — typically `import.meta.url` at the call site — used to locate the `package.json` that describes the running process. See [NPM identity](#npm-identity) for the resolution rules.

## License

AGPL-3.0-or-later
