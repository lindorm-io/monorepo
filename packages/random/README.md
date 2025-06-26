# @lindorm/random

Collection of tiny **cryptographically-strong random helpers** powered by Node’s `crypto.randomBytes`.

---

## Available helpers

* `randomString(length)` – alphanumeric + symbol string
* `randomSecret(length)` – stronger variant emphasising symbols / numbers
* `randomNumber(min, max)` – pseudo random integer (inclusive)
* `randomId(options?)` – base64url id with optional namespace & timestamp

The functions are fully tree-shakeable – import only what you need.

---

## Installation

```bash
npm install @lindorm/random
# or
yarn add @lindorm/random
```

---

## Usage examples

```ts
import { randomString, randomSecret, randomNumber, randomId } from '@lindorm/random';

const token  = randomString(32);  // 'p7Z.DDqvW…'
const secret = randomSecret(64);  // strong password
const code   = randomNumber(100000, 999999); // 2-FA code

const id = randomId({
  namespace: 'usr',
  timestamp: true,  // embed millis since epoch (base36)
  entropy: 128,     // bits (default 128)
});
```

---

## API details

### `randomId({ entropy, namespace, timestamp })`

* **entropy** – total bits of randomness (default `128`, min `16`, multiple of 16)
* **namespace** – up to 32 ASCII chars placed in the middle of the id
* **timestamp** – when `true` embeds `Date.now()` (base36) after the namespace

The resulting id is base64url-encoded and therefore safe for URLs and filenames.

### `randomNumber(min, max)`

Returns a uniform integer in the inclusive range `[min, max]` using rejection sampling.

---

## TypeScript

All helpers include proper type declarations.  There are **no runtime dependencies** beyond Node’s
crypto module.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

