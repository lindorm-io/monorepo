# @lindorm/akp

Post-quantum signature kit built on Node's `crypto` module and [`@lindorm/kryptos`](https://github.com/lindorm-io/monorepo/tree/main/packages/kryptos). Provides an `AkpKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

`AkpKit` wraps the `AKP` ("Algorithm Key Pair") kryptos key type, which carries the ML-DSA family of signature algorithms standardised in FIPS 204 (formerly CRYSTALS-Dilithium).

## Installation

```bash
npm install @lindorm/akp
```

## Quick Start

```typescript
import { AkpKit } from "@lindorm/akp";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-65" });
const kit = new AkpKit({ kryptos });

// Sign
const signature = kit.sign("hello world");

// Verify
kit.verify("hello world", signature); // true

// Assert (throws AkpError if invalid)
kit.assert("hello world", signature);

// Format Buffer to string
kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new AkpKit({
  kryptos, // IKryptos — must be an AKP key
  encoding: "base64", // BufferEncoding — output encoding (default: "base64")
});
```

The constructor validates that the key is an AKP type. Other key types (EC, OKP, RSA, oct) are rejected with an `AkpError`.

## API

```typescript
class AkpKit implements IKeyKit {
  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void; // throws AkpError
  format(data: Buffer): string;
}
```

`KeyData` is `Buffer | string`.

## Supported Algorithms

| Algorithm | NIST Level | Signature size |
| --------- | ---------- | -------------- |
| ML-DSA-44 | 2          | 2420 bytes     |
| ML-DSA-65 | 3          | 3309 bytes     |
| ML-DSA-87 | 5          | 4627 bytes     |

Signatures are produced and verified via Node's native `crypto.sign` / `crypto.verify` with a `null` digest (ML-DSA has its own internal hashing). There is no `dsaEncoding` choice — ML-DSA signatures are fixed-size byte strings.

## Error Handling

All errors are `AkpError` instances:

```typescript
import { AkpError } from "@lindorm/akp";
```

## License

AGPL-3.0-or-later
