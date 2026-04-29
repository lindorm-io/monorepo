# @lindorm/rsa

RSA signing kit built on Node's `crypto` module and [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos). Provides an `RsaKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

This package is **ESM-only**.

## Installation

```bash
npm install @lindorm/rsa
```

`RsaKit` accepts an `IKryptos` instance constructed by the consumer, so [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos) must also be installed in your project.

## Features

- Sign, verify, and assert RSA signatures over `Buffer` or `string` input
- Supports `RS256`, `RS384`, `RS512` (PKCS#1 v1.5) and `PS256`, `PS384`, `PS512` (PSS, salt length 32)
- Configurable string output encoding via Node's `BufferEncoding`
- Rejects non-RSA keys and RSA encryption algorithms (e.g. `RSA-OAEP`) at construction time

## Quick Start

```typescript
import { RsaKit } from "@lindorm/rsa";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.rsa({ algorithm: "PS256" });
const kit = new RsaKit({ kryptos });

const signature = kit.sign("hello world");

kit.verify("hello world", signature); // true

kit.assert("hello world", signature); // throws RsaError if invalid

kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new RsaKit({
  kryptos, // IKryptos — must be an RSA key with a signing algorithm
  dsa: "der", // DsaEncoding — "der" | "ieee-p1363" (default: "der")
  encoding: "base64", // BufferEncoding — string encoding for verify/format (default: "base64")
});
```

The constructor validates that the key is an RSA key with one of the supported signing algorithms (`RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512`). RSA encryption keys and non-RSA keys are rejected with an `RsaError`.

## API

```typescript
class RsaKit implements IKeyKit {
  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void; // throws RsaError
  format(data: Buffer): string;
}
```

`KeyData` is `Buffer | string`.

- `sign(data)` — produces a signature `Buffer` using the configured key and algorithm.
- `verify(data, signature)` — returns `true` if the signature is valid. String signatures are decoded using the configured `encoding`.
- `assert(data, signature)` — same as `verify`, but throws `RsaError` instead of returning `false`.
- `format(buffer)` — encodes a signature `Buffer` to a string using the configured `encoding`.

## Supported Algorithms

| Algorithm | Padding     | Hash    |
| --------- | ----------- | ------- |
| RS256     | PKCS#1 v1.5 | SHA-256 |
| RS384     | PKCS#1 v1.5 | SHA-384 |
| RS512     | PKCS#1 v1.5 | SHA-512 |
| PS256     | PSS         | SHA-256 |
| PS384     | PSS         | SHA-384 |
| PS512     | PSS         | SHA-512 |

PSS variants are signed and verified with a salt length of 32 bytes.

## Error Handling

All errors thrown by this package are instances of `RsaError`:

```typescript
import { RsaError } from "@lindorm/rsa";
```

## License

AGPL-3.0-or-later
