# @lindorm/rsa

RSA signature kit built on Node's `crypto` module and [`@lindorm/kryptos`](../kryptos). Provides an `RsaKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

## Installation

```bash
npm install @lindorm/rsa
```

## Quick Start

```typescript
import { RsaKit } from "@lindorm/rsa";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.rsa({ algorithm: "PS256" });
const kit = new RsaKit({ kryptos });

// Sign
const signature = kit.sign("hello world");

// Verify
kit.verify("hello world", signature); // true

// Assert (throws RsaError if invalid)
kit.assert("hello world", signature);

// Format Buffer to string
kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new RsaKit({
  kryptos, // IKryptos — must be an RSA key with a signing algorithm
  dsa: "der", // DsaEncoding — "der" | "ieee-p1363" (default: "der")
  encoding: "base64", // BufferEncoding — output encoding (default: "base64")
});
```

The constructor validates that the key is an RSA type with a supported signing algorithm (RS256, RS384, RS512, PS256, PS384, PS512). Encryption keys (RSA-OAEP etc.) are rejected with an `RsaError`.

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

## Supported Algorithms

| Algorithm | Padding     | Hash    |
| --------- | ----------- | ------- |
| RS256     | PKCS#1 v1.5 | SHA-256 |
| RS384     | PKCS#1 v1.5 | SHA-384 |
| RS512     | PKCS#1 v1.5 | SHA-512 |
| PS256     | PSS         | SHA-256 |
| PS384     | PSS         | SHA-384 |
| PS512     | PSS         | SHA-512 |

## Error Handling

All errors are `RsaError` instances:

```typescript
import { RsaError } from "@lindorm/rsa";
```

## License

AGPL-3.0-or-later
