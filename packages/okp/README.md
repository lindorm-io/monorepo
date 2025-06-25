# @lindorm/okp

Simple **EdDSA / OKP (Octet-Key Pair) signing kit** built on top of Node’s `crypto` module and the
[`@lindorm/kryptos`](../kryptos) key utilities.  The kit exposes a small `OkpKit` class which
implements the generic `IKeyKit` contract used throughout the Lindorm cryptography packages.

---

## Installation

```bash
npm install @lindorm/okp
# or
yarn add @lindorm/okp
```

You will also need a compatible key instance:

```ts
import { KryptosKit } from '@lindorm/kryptos';

const ED25519 = KryptosKit.generate.okp({ alg: 'Ed25519', use: 'sig' });
```

---

## Example

```ts
import { OkpKit } from '@lindorm/okp';
import { randomBytes } from 'node:crypto';

const kit = new OkpKit({ kryptos: ED25519, encoding: 'base64url' });

const data = randomBytes(32);

// Sign → Buffer
const signature = kit.sign(data);

// Verify
if (kit.verify(data, signature)) {
  console.log('✔️  valid');
}

// Throw when invalid
kit.assert(data, signature);

// Convert Buffer → string
const asString = kit.format(signature);
```

### DSA encoding

`OkpKit` defaults to DER encoding (`dsa: 'der'`) but you can switch to IETF-style `ieee-p1363` if
required:

```ts
const kit = new OkpKit({ kryptos: ED25519, dsa: 'ieee-p1363' });
```

---

## API

```ts
class OkpKit implements IKeyKit {
  constructor(options: {
    kryptos: IKryptosOkp;
    dsa?: DsaEncoding;          // 'der' | 'ieee-p1363' (default 'der')
    encoding?: BufferEncoding;  // default 'base64'
  });

  sign(data: KeyData): Buffer;
  verify(data: KeyData, signature: KeyData): boolean;
  assert(data: KeyData, signature: KeyData): void; // throws OkpError on mismatch
  format(data: Buffer): string;                     // encode Buffer → string
}
```

`KeyData` can be `Buffer`, `string` or `Uint8Array`.

---

## TypeScript

The package is written in TypeScript and ships with declaration files.  Runtime dependencies are
limited to **Node.js built-ins** and other Lindorm utilities.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

