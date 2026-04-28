# @lindorm/enigma

Argon2id password hashing for Node.js, plus a layered `Enigma` helper that combines HMAC signing, Argon2 hashing, and AES encryption into a single `hash` / `verify` / `assert` interface.

## Installation

```bash
npm install @lindorm/enigma
```

This package is ESM-only. Import it with `import`; CommonJS `require` is not supported.

## Features

- `ArgonKit` — thin wrapper around [`argon2`](https://www.npmjs.com/package/argon2) with configurable `hashLength`, `memoryCost`, `parallelism`, and `timeCost`.
- Optional Argon2 pepper sourced from a `@lindorm/kryptos` OCT key (the key's private bytes are passed through as the Argon2 `secret`).
- `Enigma` — layered helper that signs the input via `OctKit`, hashes the signature with `ArgonKit`, then encrypts the hash with `AesKit`.
- `hash`, `verify`, and `assert` semantics on both kits. `assert` rejects with a typed error (`ArgonError` or `EnigmaError`) on mismatch.

## Usage

### ArgonKit

```typescript
import { ArgonKit } from "@lindorm/enigma";

const kit = new ArgonKit();

const hash = await kit.hash("super-secret");

await kit.verify("super-secret", hash); // true
await kit.assert("super-secret", hash); // resolves
await kit.assert("wrong", hash); // throws ArgonError
```

#### With a pepper

`ArgonKit` accepts an optional `IKryptosOct`. The OCT key's private material is forwarded to Argon2 as the `secret` parameter (commonly called a pepper). The constructor throws `OctError` from `@lindorm/oct` if the supplied key is not an OCT key.

```typescript
import { ArgonKit } from "@lindorm/enigma";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });

const kit = new ArgonKit({ kryptos });

const hash = await kit.hash("super-secret");
```

### Enigma

`Enigma` chains three layers: HMAC sign → Argon2 hash → AES encrypt. `hash` returns the AES ciphertext; `verify` reverses the layers.

```typescript
import { Enigma } from "@lindorm/enigma";
import { KryptosKit } from "@lindorm/kryptos";

const aesKryptos = KryptosKit.generate.enc.oct({
  algorithm: "dir",
  encryption: "A256GCM",
});
const octKryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });

const enigma = new Enigma({
  aes: { kryptos: aesKryptos },
  oct: { kryptos: octKryptos },
});

const hash = await enigma.hash("super-secret");

await enigma.verify("super-secret", hash); // true
await enigma.assert("wrong", hash); // throws EnigmaError
```

`Enigma` accepts an optional `argon` block that is forwarded to the inner `ArgonKit`:

```typescript
const enigma = new Enigma({
  aes: { kryptos: aesKryptos },
  oct: { kryptos: octKryptos },
  argon: { hashLength: 128, memoryCost: 131072, timeCost: 16 },
});
```

## API

### `class ArgonKit`

`new ArgonKit(options?: ArgonKitOptions)`.

| Option        | Type          | Default | Notes                                                                              |
| ------------- | ------------- | ------- | ---------------------------------------------------------------------------------- |
| `hashLength`  | `number`      | `256`   | Argon2 output length in bytes.                                                     |
| `memoryCost`  | `number`      | `65536` | Memory in KiB.                                                                     |
| `parallelism` | `number`      | `8`     | Number of Argon2 lanes (threads).                                                  |
| `timeCost`    | `number`      | `12`    | Number of iterations.                                                              |
| `kryptos`     | `IKryptosOct` | —       | Optional OCT key whose DER private bytes are used as the Argon2 `secret` (pepper). |

Methods (all async):

- `hash(data: string): Promise<string>` — returns an Argon2id encoded hash string.
- `verify(data: string, hash: string): Promise<boolean>` — `true` when `data` matches `hash`.
- `assert(data: string, hash: string): Promise<void>` — rejects with `ArgonError` when verification fails.

### `class Enigma`

`new Enigma(options: EnigmaOptions)`.

`EnigmaOptions`:

| Field   | Type              | Required | Notes                                                                                         |
| ------- | ----------------- | -------- | --------------------------------------------------------------------------------------------- |
| `aes`   | `AesKitOptions`   | yes      | Forwarded to `AesKit` from `@lindorm/aes`. Must include a `kryptos` key suitable for AES.     |
| `oct`   | `OctKitOptions`   | yes      | Forwarded to `OctKit` from `@lindorm/oct`. Must include a `kryptos` OCT key for HMAC signing. |
| `argon` | `ArgonKitOptions` | no       | Forwarded to the inner `ArgonKit` (see above).                                                |

Methods (all async):

- `hash(data: string): Promise<string>` — sign → Argon2 hash → AES encrypt.
- `verify(data: string, hash: string): Promise<boolean>` — reverses the layers.
- `assert(data: string, hash: string): Promise<void>` — rejects with `EnigmaError` on mismatch.

### Errors

- `ArgonError` — thrown when `ArgonKit#assert` fails verification, and when a pepper key is supplied without exportable private bytes.
- `EnigmaError` — thrown when `Enigma#assert` fails verification.

Both extend `LindormError` from `@lindorm/errors`.

### Exported types

`ArgonKitOptions`, `EnigmaOptions`, `CreateArgonHashOptions`, and `VerifyArgonHashOptions` are exported from the package root.

## License

AGPL-3.0-or-later
