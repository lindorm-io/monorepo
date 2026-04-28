# @lindorm/sha

Thin SHA-1/256/384/512 hashing helper that wraps Node's `crypto.createHash` in a typed class.

## Installation

```bash
npm install @lindorm/sha
```

This package is **ESM-only**. Use `import` syntax; `require` is not supported.

## Features

- `ShaKit` class with configurable algorithm and encoding
- Instance helpers to `hash`, `verify`, and `assert` digests against input data
- Static one-shot helpers `S1`, `S256`, `S384`, `S512` that produce `base64url` digests and accept both `string` and `Buffer` input
- `ShaError` thrown by `assert` on mismatch

## Usage

```ts
import { ShaKit } from "@lindorm/sha";

const sha = new ShaKit({ algorithm: "SHA512", encoding: "hex" });

const digest = sha.hash("hello world");

sha.verify("hello world", digest); // true
sha.assert("hello world", digest); // void; throws ShaError on mismatch
```

Defaults are `algorithm: "SHA256"` and `encoding: "base64"` when no options are passed:

```ts
import { ShaKit } from "@lindorm/sha";

const sha = new ShaKit();
const digest = sha.hash("hello world");
```

The static helpers always emit `base64url` and accept either a string or a `Buffer`:

```ts
import { ShaKit } from "@lindorm/sha";

const a = ShaKit.S256("data");
const b = ShaKit.S256(Buffer.from("data", "utf8"));
// a === b
```

> `ShaKit.S1` exists for legacy interop only (e.g. the X.509 `x5t` thumbprint per RFC 7515 §4.1.7). SHA-1 is cryptographically broken; do not use it for authentication, integrity, or any security-sensitive purpose.

Catching mismatches:

```ts
import { ShaKit, ShaError } from "@lindorm/sha";

const sha = new ShaKit();
const digest = sha.hash("expected");

try {
  sha.assert("actual", digest);
} catch (err) {
  if (err instanceof ShaError) {
    // hash did not match
  }
}
```

## API

### `class ShaKit`

```ts
new ShaKit(options?: ShaKitOptions);
```

| Option      | Type                                         | Default    | Description                                |
| ----------- | -------------------------------------------- | ---------- | ------------------------------------------ |
| `algorithm` | `"SHA1" \| "SHA256" \| "SHA384" \| "SHA512"` | `"SHA256"` | Digest algorithm used by instance methods. |
| `encoding`  | `BinaryToTextEncoding` (Node `crypto`)       | `"base64"` | Output encoding used by instance methods.  |

#### Instance methods

- `hash(data: string): string` — returns the digest of `data` using the configured algorithm and encoding.
- `verify(data: string, hash: string): boolean` — returns `true` if hashing `data` produces `hash`.
- `assert(data: string, hash: string): void` — throws `ShaError` with message `"Hash does not match"` if `verify` would return `false`.

#### Static methods

All static methods accept `string | Buffer` and return a `base64url` digest. The configured instance algorithm/encoding does not apply.

- `ShaKit.S1(data: string | Buffer): string`
- `ShaKit.S256(data: string | Buffer): string`
- `ShaKit.S384(data: string | Buffer): string`
- `ShaKit.S512(data: string | Buffer): string`

### `class ShaError`

Extends `LindormError` from `@lindorm/errors`. Thrown by `ShaKit.prototype.assert` when the supplied hash does not match the input.

### Types

- `ShaKitOptions` — `{ algorithm?: ShaAlgorithm; encoding?: BinaryToTextEncoding }`
- `CreateShaHashOptions` — `{ algorithm?: ShaAlgorithm; data: string | Buffer; encoding?: BinaryToTextEncoding }`
- `VerifyShaHashOptions` — `{ algorithm?: ShaAlgorithm; data: string | Buffer; encoding?: BinaryToTextEncoding; hash: string }`

`ShaAlgorithm` is re-exported transitively from `@lindorm/types` and resolves to `"SHA1" | "SHA256" | "SHA384" | "SHA512"`. `BinaryToTextEncoding` is the type from Node's built-in `crypto` module.

## License

AGPL-3.0-or-later
