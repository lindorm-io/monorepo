# @lindorm/b64

Base64 and Base64URL encoding helpers for Node.js and browsers, exposed as a single static class.

## Installation

```bash
npm install @lindorm/b64
```

This package is ESM-only and has no runtime dependencies. Encoding and decoding are implemented on top of the standard `Uint8Array.prototype.toBase64` / `Uint8Array.fromBase64` methods, so the runtime must support them (Node.js 22+ or a current evergreen browser). The `toBuffer` method additionally requires the Node.js `Buffer` global and is not available in browsers.

## Features

- Encode `Uint8Array` (including Node `Buffer`) or `string` input to Base64 or Base64URL.
- Decode either format to a `Uint8Array`, a UTF-8 `string`, or — in Node.js — a `Buffer`. Decoding auto-handles URL-safe input by normalizing `-`/`_` to `+`/`/` before decoding.
- Short aliases for the encoding option: `"b64"` for `"base64"`; `"b64url"` and `"b64u"` for `"base64url"`.
- Cheap regex-based character-set checks for both alphabets.

## Usage

```typescript
import { B64 } from "@lindorm/b64";

const input = "hello there - general kenobi";

B64.encode(input); // "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ=="
B64.encode(input, "base64"); // "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ=="
B64.encode(input, "b64"); // "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ=="
B64.encode(input, "base64url"); // "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ"
B64.encode(input, "b64url"); // "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ"
B64.encode(input, "b64u"); // "aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ"

B64.toString("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==");
// "hello there - general kenobi"

B64.toString("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ");
// "hello there - general kenobi"

B64.toBytes("aGVsbG8gdGhlcmUgLSBnZW5lcmFsIGtlbm9iaQ==");
// Uint8Array<...> equal to new TextEncoder().encode("hello there - general kenobi")
```

`encode` accepts any `Uint8Array` directly, including a Node `Buffer`:

```typescript
import { B64 } from "@lindorm/b64";

const bytes = new TextEncoder().encode("hello there - general kenobi");
const encoded = B64.encode(bytes, "base64url");
const roundTripped = B64.toBytes(encoded);
```

In Node.js, the same flow works with `Buffer`:

```typescript
import { B64 } from "@lindorm/b64";

const buffer = Buffer.from("hello there - general kenobi", "utf8");
const encoded = B64.encode(buffer, "base64url");
const roundTripped = B64.toBuffer(encoded); // Node-only
```

### Decoding behavior

`decode`, `toBytes`, `toBuffer`, and `toString` are format-agnostic by default: they normalize URL-safe characters before decoding, so either Base64 or Base64URL input works without specifying the encoding. The only special case is passing `"base64"` explicitly, which skips normalization and decodes against the standard alphabet directly. Pass `"base64"` only when you know the input is standard Base64 — input containing `-` or `_` will throw a `SyntaxError` in that mode.

String input to `encode` is encoded as UTF-8. `decode` and `toString` decode the resulting bytes as UTF-8.

### Character-set checks

`isBase64` and `isBase64Url` are regex character-set checks, not strict format validators. They each test that the input only uses the characters of the corresponding alphabet, with up to two trailing `=`:

- `isBase64`: `^[A-Za-z0-9+/]*={0,2}$`
- `isBase64Url`: `^[A-Za-z0-9-_]*={0,2}$`

A string consisting only of `A-Z`, `a-z`, and `0-9` (with no `+`, `/`, `-`, or `_`) satisfies both. Neither check enforces correct length or padding, so a passing result does not guarantee the input decodes cleanly.

## API

### `class B64`

All members are static.

| Member                                                                       | Description                                                                                                                              |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `B64.encode(input: Uint8Array \| string, encoding?: Base64Encoding): string` | Encodes `input` as Base64 (default) or Base64URL. String input is encoded as UTF-8. Accepts any `Uint8Array`, including a Node `Buffer`. |
| `B64.decode(input: string, encoding?: Base64Encoding): string`               | Decodes `input` and returns its UTF-8 string form. Auto-handles URL-safe input unless `encoding` is `"base64"`.                          |
| `B64.toBytes(input: string, encoding?: Base64Encoding): Uint8Array`          | Same as `decode` but returns a `Uint8Array`. Works in Node.js and browsers.                                                              |
| `B64.toBuffer(input: string, encoding?: Base64Encoding): Buffer`             | Same as `toBytes` but returns a Node `Buffer`. Node.js only.                                                                             |
| `B64.toString(input: string, encoding?: Base64Encoding): string`             | Alias of `decode`.                                                                                                                       |
| `B64.isBase64(input: string): boolean`                                       | Returns `true` if `input` only contains characters from the Base64 alphabet (with up to two trailing `=`).                               |
| `B64.isBase64Url(input: string): boolean`                                    | Returns `true` if `input` only contains characters from the Base64URL alphabet (with up to two trailing `=`).                            |

### `type Base64Encoding`

```typescript
type Base64Encoding = "base64" | "base64url" | "b64" | "b64url" | "b64u";
```

`"base64"` and `"b64"` select standard Base64 with `=` padding. `"base64url"`, `"b64url"`, and `"b64u"` select URL-safe Base64 without padding.

## License

AGPL-3.0-or-later
