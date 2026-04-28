# @lindorm/oct

HMAC signing kit built on Node's `crypto` module and [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos). Provides an `OctKit` class that implements the `IKeyKit` contract used across the Lindorm cryptography packages.

This package is **ESM-only**.

## Installation

```bash
npm install @lindorm/oct
```

`OctKit` accepts an `IKryptos` instance constructed by the consumer, so [`@lindorm/kryptos`](https://www.npmjs.com/package/@lindorm/kryptos) must also be installed in your project.

## Features

- Sign, verify, and assert HMAC signatures over `Buffer` or `string` input
- Supports `HS256`, `HS384`, and `HS512`
- Timing-safe signature comparison via `crypto.timingSafeEqual`
- Configurable string output encoding via Node's `BufferEncoding`
- Rejects non-oct keys and oct encryption algorithms at construction time

## Quick Start

```typescript
import { OctKit } from "@lindorm/oct";
import { KryptosKit } from "@lindorm/kryptos";

const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });
const kit = new OctKit({ kryptos });

const signature = kit.sign("hello world");

kit.verify("hello world", signature); // true

kit.assert("hello world", signature); // throws OctError if invalid

kit.format(signature); // base64 string
```

## Constructor Options

```typescript
new OctKit({
  kryptos, // IKryptos — must be an oct key with a signing algorithm
  encoding: "base64", // BufferEncoding — string encoding for verify/format (default: "base64")
});
```

The constructor validates that the key is an oct key with one of the supported signing algorithms (`HS256`, `HS384`, `HS512`). Non-oct keys and oct encryption algorithms are rejected with an `OctError`.

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

- `sign(data)` — produces an HMAC digest as a `Buffer`.
- `verify(data, signature)` — returns `true` if the signature matches. String signatures are decoded using the configured `encoding`. Comparison is timing-safe.
- `assert(data, signature)` — same as `verify`, but throws `OctError` instead of returning `false`.
- `format(buffer)` — encodes a signature `Buffer` to a string using the configured `encoding`.

## Supported Algorithms

| Algorithm | Hash    |
| --------- | ------- |
| HS256     | SHA-256 |
| HS384     | SHA-384 |
| HS512     | SHA-512 |

## Error Handling

All errors thrown by this package are instances of `OctError`:

```typescript
import { OctError } from "@lindorm/oct";
```

## License

AGPL-3.0-or-later
