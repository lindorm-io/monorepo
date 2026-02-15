# @lindorm/okp

EdDSA signature kit built on Node's `crypto` module and [`@lindorm/kryptos`](../kryptos). Provides an `OkpKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

## Installation

```bash
npm install @lindorm/okp
```

## Quick Start

```typescript
import { OkpKit } from "@lindorm/okp";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.okp({ algorithm: "EdDSA", curve: "Ed25519" });
const kit = new OkpKit({ kryptos });

// Sign
const signature = kit.sign("hello world");

// Verify
kit.verify("hello world", signature); // true

// Assert (throws OkpError if invalid)
kit.assert("hello world", signature);

// Format Buffer to string
kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new OkpKit({
  kryptos, // IKryptos — must be an OKP key with a signing curve
  dsa: "der", // DsaEncoding — "der" | "ieee-p1363" (default: "der")
  encoding: "base64", // BufferEncoding — output encoding (default: "base64")
});
```

The constructor validates that the key is an OKP type with a supported signing curve (Ed25519, Ed448). Encryption curves (X25519, X448) are rejected with an `OkpError`.

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

## Supported Curves

| Curve   | Algorithm | Use     |
| ------- | --------- | ------- |
| Ed25519 | EdDSA     | Signing |
| Ed448   | EdDSA     | Signing |

X25519 and X448 are encryption curves and are not supported by `OkpKit`. Use the [`@lindorm/aes`](../aes) package for encryption with OKP keys.

## Error Handling

All errors are `OkpError` instances:

```typescript
import { OkpError } from "@lindorm/okp";
```

## License

AGPL-3.0-or-later
