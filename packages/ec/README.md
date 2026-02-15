# @lindorm/ec

ECDSA digital signature kit built on Node's `crypto` module and [`@lindorm/kryptos`](../kryptos). Provides an `EcKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

## Installation

```bash
npm install @lindorm/ec
```

## Quick Start

```typescript
import { EcKit } from "@lindorm/ec";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.ec({ algorithm: "ES512" });
const kit = new EcKit({ kryptos });

// Sign
const signature = kit.sign("hello world");

// Verify
kit.verify("hello world", signature); // true

// Assert (throws EcError if invalid)
kit.assert("hello world", signature);

// Format Buffer to string
kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new EcKit({
  kryptos, // IKryptos — must be an EC key with a signing algorithm
  dsa: "der", // DsaEncoding — "der" | "ieee-p1363" (default: "der")
  encoding: "base64", // BufferEncoding — output encoding (default: "base64")
  raw: false, // boolean — use raw r||s concatenation (default: false)
});
```

The constructor validates that the key is an EC type with a supported signing algorithm (ES256, ES384, ES512). Encryption keys (ECDH-ES etc.) are rejected with an `EcError`.

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

## Supported Algorithms

| Algorithm | Curve | Hash    |
| --------- | ----- | ------- |
| ES256     | P-256 | SHA-256 |
| ES384     | P-384 | SHA-384 |
| ES512     | P-521 | SHA-512 |

## DSA Encoding

- **DER** (default) -- standard ASN.1 format
- **IEEE-P1363** -- fixed-length format used in some protocols

The `raw` option controls whether signatures use raw r||s concatenation, which is useful for JWT/JWS compatibility.

## Error Handling

All errors are `EcError` instances:

```typescript
import { EcError } from "@lindorm/ec";
```

## License

AGPL-3.0-or-later
