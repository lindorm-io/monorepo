# @lindorm/akp

Post-quantum signature kit for the ML-DSA family (FIPS 204), built on Node's `crypto` module and [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos). Provides an `AkpKit` class implementing the `IKeyKit` contract used across the Lindorm cryptography packages.

This package is **ESM-only**. All examples use `import`; CommonJS `require` is not supported.

## Installation

```bash
npm install @lindorm/akp
```

## Features

- Sign, verify, and assert ML-DSA signatures with a single class
- Accepts string or `Buffer` input for both data and signature
- Configurable output encoding for signature formatting
- Runtime validation that the supplied `Kryptos` key is an AKP key
- Errors surface as a single `AkpError` type

## Quick Start

```typescript
import { AkpKit } from "@lindorm/akp";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-65" });
const kit = new AkpKit({ kryptos });

const signature = kit.sign("hello world");

kit.verify("hello world", signature); // true

kit.assert("hello world", signature); // throws AkpError on mismatch

kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new AkpKit({
  kryptos, // IKryptos — must be an AKP-typed key, otherwise AkpError is thrown
  encoding: "base64", // BufferEncoding — used by verify/assert when signature is a string,
  //                  and by format() for Buffer-to-string conversion
  //                  (default: "base64")
});
```

The constructor calls `KryptosKit.isAkp(...)` on the supplied key. Any non-AKP key (EC, OKP, RSA, oct) is rejected with an `AkpError` containing the message `"Invalid Kryptos instance"`.

## API

```typescript
class AkpKit implements IKeyKit {
  constructor(options: AkpKitOptions);
  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void;
  format(data: Buffer): string;
}
```

`KeyData` is `Buffer | string` (re-exported from `@lindorm/types`).

| Method   | Description                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------- |
| `sign`   | Produces an ML-DSA signature `Buffer` over the data using the kryptos private key.                |
| `verify` | Returns `true` if the signature matches the data, `false` otherwise.                              |
| `assert` | Throws `AkpError("Invalid signature")` if the signature does not match; otherwise returns `void`. |
| `format` | Encodes a `Buffer` using the kit's configured encoding.                                           |

When `signature` is supplied as a string, `verify` and `assert` decode it using the configured `encoding`. Data passed as a string is always treated as UTF-8.

If the kryptos key was created without a private half, calling `sign` throws `AkpError("Missing private key")`. Likewise, a key with no public half throws `AkpError("Missing public key")` on `verify`/`assert`.

### Exported types

```typescript
import type { AkpKitOptions } from "@lindorm/akp";
```

`CreateAkpSignatureOptions` and `VerifyAkpSignatureOptions` are also exported for consumers who need to mirror the underlying signature contract.

## Supported Algorithms

| Algorithm   |
| ----------- |
| `ML-DSA-44` |
| `ML-DSA-65` |
| `ML-DSA-87` |

Algorithms are configured on the underlying `Kryptos` instance, not on the kit. Signatures are produced via `crypto.sign(null, …)` / `crypto.verify(null, …)` — ML-DSA performs its own internal hashing, so no digest is passed.

## Errors

```typescript
import { AkpError } from "@lindorm/akp";
```

Every error thrown by this package is an instance of `AkpError`.

## License

AGPL-3.0-or-later
