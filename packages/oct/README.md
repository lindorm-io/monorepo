# @lindorm/oct

HMAC signature kit built on Node's `crypto` module and [`@lindorm/kryptos`](../kryptos). Provides an `OctKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

## Installation

```bash
npm install @lindorm/oct
```

## Quick Start

```typescript
import { OctKit } from "@lindorm/oct";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });
const kit = new OctKit({ kryptos });

// Sign
const signature = kit.sign("hello world");

// Verify (timing-safe comparison)
kit.verify("hello world", signature); // true

// Assert (throws OctError if invalid)
kit.assert("hello world", signature);

// Format Buffer to string
kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new OctKit({
  kryptos, // IKryptos — must be an oct key with a signing algorithm
  encoding: "base64", // BufferEncoding — output encoding (default: "base64")
});
```

The constructor validates that the key is an oct type with a supported signing algorithm (HS256, HS384, HS512). Encryption keys (A128KW, dir, etc.) are rejected with an `OctError`.

## API

```typescript
class OctKit implements IKeyKit {
  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void; // throws OctError
  format(data: Buffer): string;
}
```

`KeyData` is `Buffer | string`.

## Supported Algorithms

| Algorithm | Hash    |
| --------- | ------- |
| HS256     | SHA-256 |
| HS384     | SHA-384 |
| HS512     | SHA-512 |

## Security

Signature verification uses `crypto.timingSafeEqual` to prevent timing attacks.

## Error Handling

All errors are `OctError` instances:

```typescript
import { OctError } from "@lindorm/oct";
```

## License

AGPL-3.0-or-later
