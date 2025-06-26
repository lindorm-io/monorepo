# @lindorm/sha

Minimal **SHA-1/256/384/512 hashing kit** that wraps Node’s `crypto.createHash` in a convenient,
type-safe API.  The `ShaKit` class exposes _hash_, _verify_ and _assert_ helpers and defaults to
`SHA256` with Base64 output.

---

## Installation

```bash
npm install @lindorm/sha
# or
yarn add @lindorm/sha
```

---

## Usage

```ts
import { ShaKit } from '@lindorm/sha';

const sha = new ShaKit({ algorithm: 'SHA512', encoding: 'hex' });

const digest = sha.hash('hello world');

console.log(digest); // → '2ae...'

sha.assert('hello world', digest); // throws ShaError on mismatch
```

---

## API

```ts
class ShaKit {
  constructor(options?: { algorithm?: ShaAlgorithm; encoding?: BinaryToTextEncoding });

  hash(data: string): string;
  verify(data: string, digest: string): boolean;
  assert(data: string, digest: string): void; // throws on mismatch
}
```

Supported algorithms (`ShaAlgorithm` from `@lindorm/types`): `SHA1`, `SHA256`, `SHA384`, `SHA512`.

---

## TypeScript

Written in TS and ships with full declarations.  Zero runtime dependencies besides the Node `crypto`
module.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

