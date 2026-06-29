# @lindorm/random

Tiny cryptographically-strong random helpers for ids, numbers, strings, and UUIDs.

## Installation

```bash
npm install @lindorm/random
```

This package is **ESM-only**. Use `import`, not `require`. It has no runtime dependencies and relies on the Web Crypto API exposed via `globalThis.crypto`.

## Features

- `randomId` — base62 id with an optional namespace prefix and configurable length
- `randomNumber` — uniform random integer with up to `length` digits, generated via rejection sampling against a 64-bit space
- `randomString` — random string with an exact count of digits and symbols, the rest filled with letters
- `randomUUID` — thin wrapper over `crypto.randomUUID()` returning a v4 UUID

## Usage

```ts
import { randomId, randomNumber, randomString, randomUUID } from "@lindorm/random";

const id = randomId();
const namespaced = randomId("usr");
const long = randomId({ namespace: "usr", length: 32 });

const code = randomNumber(6);

const token = randomString(32);
const password = randomString(24, { numbers: 4, symbols: 4 });

const uuid = randomUUID();
```

## API

### `randomId`

Returns a base62 random id, optionally prefixed by `<namespace>_`.

```ts
randomId(): string;
randomId(namespace: string, options?: { length?: RandomIdLength }): string;
randomId(options: { namespace?: string; length?: RandomIdLength }): string;
```

`RandomIdLength` is one of `16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64`. The default is `24`. The id body is exactly `length` characters drawn from `[A-Za-z0-9]` (base62, generated via rejection sampling to avoid modulo bias), making it safe for URLs, filenames, and headers. When a `namespace` is supplied, the result is `${namespace}_${id}`; the namespace must be non-empty and match `[A-Za-z0-9]+`, otherwise an error is thrown (a symbol in the namespace would make `namespace_id` ambiguous to split).

### `randomNumber`

```ts
const fn = (length: number) => number;
```

Returns a uniformly distributed integer in the inclusive range `[0, 10^length - 1]`. For example, `randomNumber(6)` returns an integer between `0` and `999999`. The result is not zero-padded; if you need a fixed-width string, format it yourself.

### `randomString`

```ts
const fn = (length: number, options?: { numbers?: number; symbols?: number }) => string;
```

Returns a random string of exactly `length` characters. `options.numbers` is the exact count of decimal digits (`0-9`) included; `options.symbols` is the exact count of symbol characters drawn from `!#$%&()*+,-./:;<=>?@[]^_{|}~`. The remaining characters are letters from `A-Za-z`. The combined `numbers + symbols` count must not exceed `length`, otherwise an error is thrown. The composed characters are shuffled before the string is returned, so the digits and symbols are not concentrated at the start.

### `randomUUID`

```ts
const fn = () => string;
```

Returns a v4 UUID by delegating to `globalThis.crypto.randomUUID()`.

## License

AGPL-3.0-or-later
