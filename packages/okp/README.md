# @lindorm/okp

EdDSA signing kit built on Node's `crypto` module and [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos). Provides an `OkpKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

This package is **ESM-only**.

## Installation

```bash
npm install @lindorm/okp
```

`OkpKit` accepts an `IKryptos` instance constructed by the consumer, so [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos) must also be installed in your project.

## Features

- Sign, verify, and assert EdDSA signatures over `Buffer` or `string` input
- Supports the `EdDSA` algorithm on the `Ed25519` and `Ed448` curves
- DSA encoding selectable between `der` and `ieee-p1363`
- Configurable string output encoding via Node's `BufferEncoding`
- Rejects non-OKP keys and OKP encryption curves (`X25519`, `X448`) at construction time

## Quick Start

```typescript
import { OkpKit } from "@lindorm/okp";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.okp({ algorithm: "EdDSA", curve: "Ed25519" });
const kit = new OkpKit({ kryptos });

const signature = kit.sign("hello world");

kit.verify("hello world", signature); // true

kit.assert("hello world", signature); // throws OkpError if invalid

kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new OkpKit({
  kryptos, // IKryptos — must be an OKP key on a signing curve (Ed25519 or Ed448)
  dsa: "der", // DsaEncoding — "der" | "ieee-p1363" (default: "der")
  encoding: "base64", // BufferEncoding — string encoding for verify/format (default: "base64")
});
```

The constructor validates that the key is an OKP key on one of the supported signing curves (`Ed25519`, `Ed448`). OKP encryption curves (`X25519`, `X448`) and non-OKP keys are rejected with an `OkpError`.

## API

```typescript
class OkpKit implements IKeyKit {
  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void; // throws OkpError
  format(data: Buffer): string;
}
```

`KeyData` is `Buffer | string`.

- `sign(data)` — produces an EdDSA signature `Buffer`. String input is encoded as UTF-8 before signing.
- `verify(data, signature)` — returns `true` if the signature is valid. String signatures are decoded using the configured `encoding`.
- `assert(data, signature)` — same as `verify`, but throws `OkpError` instead of returning `false`.
- `format(buffer)` — encodes a signature `Buffer` to a string using the configured `encoding`.

## Supported Curves

| Curve   | Algorithm | Use     |
| ------- | --------- | ------- |
| Ed25519 | EdDSA     | Signing |
| Ed448   | EdDSA     | Signing |

`X25519` and `X448` are OKP encryption curves and are not supported by `OkpKit`. For Diffie-Hellman key agreement and content encryption with those curves, see [`@lindorm/aes`](https://www.npmjs.com/package/@lindorm/aes).

## Error Handling

All errors thrown by this package are instances of `OkpError`:

```typescript
import { OkpError } from "@lindorm/okp";
```

## License

AGPL-3.0-or-later
