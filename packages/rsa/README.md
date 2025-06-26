# @lindorm/rsa

Lightweight **RSA signing / verification kit** that wraps a `RSxxx` key from
[`@lindorm/kryptos`](../kryptos).  Provides a convenient `RsaKit` class that fulfils the `IKeyKit`
contract used by the Lindorm crypto packages.

---

## Installation

```bash
npm install @lindorm/rsa
# or
yarn add @lindorm/rsa
```

Generate or import a key via Kryptos:

```ts
import { KryptosKit } from '@lindorm/kryptos';

const RS256 = KryptosKit.generate.rsa({ alg: 'RS256', use: 'sig', modulusLength: 2048 });
```

---

## Example

```ts
import { RsaKit } from '@lindorm/rsa';

const kit = new RsaKit({ kryptos: RS256, encoding: 'base64url' });

const signature = kit.sign('hello');

kit.assert('hello', signature); // throws RsaError if invalid

console.log(kit.format(signature)); // string representation
```

### DSA encoding

Set `dsa: 'ieee-p1363'` when you need raw concatenated r||s encoding instead of DER:

```ts
const kit = new RsaKit({ kryptos: RS256, dsa: 'ieee-p1363' });
```

---

## API

```ts
class RsaKit implements IKeyKit {
  constructor(options: {
    kryptos: IKryptosRsa;
    dsa?: DsaEncoding;          // 'der' | 'ieee-p1363' (default 'der')
    encoding?: BufferEncoding;  // default 'base64'
  });

  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void; // throws RsaError
  format(buf: Buffer): string;                      // encode Buffer → string
}
```

`KeyData` accepts `Buffer`, `string` or `Uint8Array`.

---

## TypeScript

Written in TS; declaration files included. Runtime dependencies are limited to Node’s `crypto`
module plus Lindorm utilities.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

