# @lindorm/pkce

Tiny helper for generating and verifying [Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) challenge/verifier pairs.

This package is **ESM-only**. Use `import`, not `require`.

## Installation

```bash
npm install @lindorm/pkce
```

## Quick Start

```ts
import { PKCE } from "@lindorm/pkce";

const { challenge, verifier, method } = PKCE.create();

const ok = PKCE.verify(challenge, verifier);

PKCE.assert(challenge, verifier);
```

## Methods

PKCE supports two challenge methods, named by the `PkceMethod` const (and its derived type):

| Method  | Challenge derivation                             |
| ------- | ------------------------------------------------ |
| `S256`  | `base64url(sha256(verifier))` — recommended.     |
| `plain` | The challenge equals the verifier — discouraged. |

`PKCE.create`, `PKCE.verify`, and `PKCE.assert` all default to `"S256"` when `method` is omitted.

## Usage

### Create a verifier and challenge

```ts
import { PKCE } from "@lindorm/pkce";

const { challenge, verifier } = PKCE.create();
```

`PKCE.create(method?, length?)` returns `{ challenge, verifier, method }`. The `verifier` is a random base64url-style string of `length` characters (default `43`); the `challenge` is derived from the verifier according to `method`.

```ts
const long = PKCE.create("S256", 128);
const plain = PKCE.create("plain");
```

### Verify a challenge

```ts
import { PKCE } from "@lindorm/pkce";

const matches = PKCE.verify(challenge, verifier);
```

`PKCE.verify(challenge, verifier, method?)` re-derives the challenge from `verifier` (or compares directly when `method` is `"plain"`) and returns `true` on match, `false` otherwise. The comparison is constant-time.

### Assert a challenge

```ts
import { PKCE, PkceError } from "@lindorm/pkce";

try {
  PKCE.assert(challenge, verifier);
} catch (error) {
  if (error instanceof PkceError) {
    // error.code === "invalid_pkce"
  }
  throw error;
}
```

`PKCE.assert(challenge, verifier, method?)` throws a `PkceError` with `code: "invalid_pkce"` on mismatch, and returns `void` on success.

## API Reference

```ts
class PKCE {
  static create(method?: PkceMethod, length?: number): PkceResult;
  static verify(challenge: string, verifier: string, method?: PkceMethod): boolean;
  static assert(challenge: string, verifier: string, method?: PkceMethod): void;
}

type PkceResult = {
  challenge: string;
  verifier: string;
  method: PkceMethod;
};

class PkceError extends LindormError {}
```

| Export       | Kind        | Description                                                                                                                                   |
| ------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PKCE`       | class       | Static façade exposing `create`, `verify`, and `assert`.                                                                                      |
| `PkceError`  | class       | Thrown by `assert` on mismatch, and by `verify`/`assert` if an unsupported `method` is passed. Extends `LindormError` from `@lindorm/errors`. |
| `PkceMethod` | const, type | The two RFC 7636 §4.2 methods — `PkceMethod.Plain` / `PkceMethod.S256`, and the derived `"plain" \| "S256"` type.                             |
| `PkceResult` | type        | Return shape of `PKCE.create`.                                                                                                                |

`PkceMethod` is this package's own vocabulary. `@lindorm/openid` carries a separate `CodeChallengeMethod` for the OAuth `code_challenge_method` wire parameter; the two hold the same values but are deliberately kept apart.

## License

AGPL-3.0-or-later
