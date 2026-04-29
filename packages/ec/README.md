# @lindorm/ec

ECDSA signing kit built on Node's `crypto` module and [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos). Provides an `EcKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

This package is **ESM-only**.

## Installation

```bash
npm install @lindorm/ec
```

`EcKit` accepts an `IKryptos` instance constructed by the consumer, so [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos) must also be installed in your project.

## Features

- Sign, verify, and assert ECDSA signatures over `Buffer` or `string` input
- Supports `ES256`, `ES384`, and `ES512` (P-256 / P-384 / P-521 curves)
- DSA encoding selectable between `der` and `ieee-p1363`
- Optional raw `r||s` signature output for JWT/JWS interop
- Configurable string output encoding via Node's `BufferEncoding`
- Rejects non-EC keys and EC encryption algorithms at construction time

## Quick Start

```typescript
import { EcKit } from "@lindorm/ec";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.ec({ algorithm: "ES512" });
const kit = new EcKit({ kryptos });

const signature = kit.sign("hello world");

kit.verify("hello world", signature); // true

kit.assert("hello world", signature); // throws EcError if invalid

kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new EcKit({
  kryptos, // IKryptos — must be an EC key with a signing algorithm
  dsa: "der", // DsaEncoding — "der" | "ieee-p1363" (default: "der")
  encoding: "base64", // BufferEncoding — string encoding for verify/format (default: "base64")
  raw: false, // boolean — emit/accept raw r||s signatures (default: false)
});
```

The constructor validates that the key is an EC key with one of the supported signing algorithms (`ES256`, `ES384`, `ES512`). EC encryption keys (e.g. `ECDH-ES`) and non-EC keys are rejected with an `EcError`.

## API

```typescript
class EcKit implements IKeyKit {
  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void; // throws EcError
  format(data: Buffer): string;
}
```

`KeyData` is `Buffer | string`.

- `sign(data)` — produces a DER-encoded signature, or raw `r||s` if `raw: true` was passed to the constructor.
- `verify(data, signature)` — returns `true` if the signature is valid. String signatures are decoded using the configured `encoding`.
- `assert(data, signature)` — same as `verify`, but throws `EcError` instead of returning `false`.
- `format(buffer)` — encodes a signature `Buffer` to a string using the configured `encoding`.

## Supported Algorithms

| Algorithm | Curve | Hash    |
| --------- | ----- | ------- |
| ES256     | P-256 | SHA-256 |
| ES384     | P-384 | SHA-384 |
| ES512     | P-521 | SHA-512 |

## DSA Encoding

- `der` (default) — standard ASN.1 DER encoding produced by Node's `crypto`.
- `ieee-p1363` — fixed-length encoding produced by Node's `crypto` when `dsaEncoding` is set.

The separate `raw` option produces or accepts a manually built `r||s` concatenation (each component padded to the curve's byte size). This is useful for JWT/JWS compatibility where the wire format is raw `r||s`.

## Error Handling

All errors thrown by this package are instances of `EcError`:

```typescript
import { EcError } from "@lindorm/ec";
```

## License

AGPL-3.0-or-later
