# @lindorm/pkce

Tiny, dependency-free helper for **Proof Key for Code Exchange (PKCE)** as defined in
[RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636).  It supports both the `plain` and `S256`
methods and gives you predictable errors via `PkceError`.

---

## Installation

```bash
npm install @lindorm/pkce
# or
yarn add @lindorm/pkce
```

---

## Usage

### Generate challenge + verifier

```ts
import { PKCE } from '@lindorm/pkce';
import { PkceMethod } from '@lindorm/enums';

const { challenge, verifier } = PKCE.create(PkceMethod.S256); // default length: 43 chars
```

### Verify server-side

```ts
if (!PKCE.verify(challenge, verifier)) {
  throw new Error('PKCE mismatch');
}

// or

PKCE.assert(challenge, verifier); // throws PkceError on mismatch
```

---

## API

```ts
class PKCE {
  static create(method?: PkceMethod, length?: number): {
    challenge: string;
    verifier: string;
    method: PkceMethod;
  };

  static verify(challenge: string, verifier: string, method?: PkceMethod): boolean;
  static assert(challenge: string, verifier: string, method?: PkceMethod): void; // throws
}
```

* **PkceMethod** is re-exported from `@lindorm/enums` and can be `Plain` or `S256`.

---

## Security notes

* Always prefer `S256` over `plain` unless interoperability forces otherwise.
* The random verifier default length (43) equals 256 bits of entropy as recommended by the spec.
* Constant-time comparison protects against timing attacks.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

