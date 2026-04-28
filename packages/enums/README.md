## @lindorm/enums

Shared TypeScript enums used across the Lindorm ecosystem.

## Installation

```bash
npm install @lindorm/enums
```

This package is ESM-only. Use `import` syntax; `require` is not supported.

## Features

- `Environment` — common runtime environment names.
- `HttpMethod` — HTTP request methods.
- `PkceMethod` — PKCE code challenge methods (RFC 7636).
- `Priority` — Lindorm priority URNs for ordered work classification.

## Usage

```typescript
import { Environment, HttpMethod, PkceMethod, Priority } from "@lindorm/enums";

const env: Environment = Environment.Production;

const method: HttpMethod = HttpMethod.Post;

const challenge: PkceMethod = PkceMethod.S256;

const priority: Priority = Priority.High;
```

Enums are TypeScript string enums, so each member is assignable to and comparable with its underlying string value.

```typescript
import { HttpMethod } from "@lindorm/enums";

const isMutation = (method: HttpMethod): boolean =>
  method === HttpMethod.Post ||
  method === HttpMethod.Put ||
  method === HttpMethod.Patch ||
  method === HttpMethod.Delete;
```

## API

### `Environment`

| Member        | Value           |
| ------------- | --------------- |
| `Production`  | `"production"`  |
| `Staging`     | `"staging"`     |
| `Development` | `"development"` |
| `Test`        | `"test"`        |
| `Unknown`     | `"unknown"`     |

### `HttpMethod`

| Member    | Value       |
| --------- | ----------- |
| `Get`     | `"GET"`     |
| `Post`    | `"POST"`    |
| `Put`     | `"PUT"`     |
| `Delete`  | `"DELETE"`  |
| `Patch`   | `"PATCH"`   |
| `Options` | `"OPTIONS"` |
| `Head`    | `"HEAD"`    |

### `PkceMethod`

| Member  | Value     |
| ------- | --------- |
| `Plain` | `"plain"` |
| `S256`  | `"S256"`  |

### `Priority`

| Member       | Value                               |
| ------------ | ----------------------------------- |
| `Default`    | `"urn:lindorm:priority:default"`    |
| `Critical`   | `"urn:lindorm:priority:critical"`   |
| `High`       | `"urn:lindorm:priority:high"`       |
| `Medium`     | `"urn:lindorm:priority:medium"`     |
| `Low`        | `"urn:lindorm:priority:low"`        |
| `Background` | `"urn:lindorm:priority:background"` |

## License

AGPL-3.0-or-later
