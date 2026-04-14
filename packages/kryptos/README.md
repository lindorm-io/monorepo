# @lindorm/kryptos

Swiss-army-knife for **JWK / PEM / DER / raw** key management with first-class
TypeScript support. `@lindorm/kryptos` lets you _generate_, _import_, _convert_,
_stamp X.509 certificates for_, and _store_ cryptographic keys (EC, OKP, RSA,
oct) without remembering a single OpenSSL command.

It includes:

- A `Kryptos` model with rich JWK metadata and lifetime fields
- `KryptosKit` — a static-only facade for generating, importing, cloning and
  type-guarding keys
- Built-in **X.509 certificate stamping** (self-signed, root CA, CA-signed
  chains) and leaf chain verification against trust anchors
- An interactive **CLI** (`kryptos generate`) for one-off `.env`-ready keys
- Secure key disposal via the TC39 `Disposable` protocol
- A mock factory and a full set of static mock keys for unit tests

---

## Installation

```bash
npm install @lindorm/kryptos

# optional — install the CLI globally
npm install -g @lindorm/kryptos
```

Requires Node `>= 24.13.0` (for `Symbol.dispose` / `using`, plus the native
WebCrypto / `crypto` APIs we rely on).

---

## Quick start

### Generate a key

```ts
import { KryptosKit } from "@lindorm/kryptos";

// Create a P-521 EC signing key (ES512)
const key = KryptosKit.generate.sig.ec({ algorithm: "ES512" });

key.id; // UUID v4
key.algorithm; // "ES512"
key.type; // "EC"
key.curve; // "P-521"
key.use; // "sig"
key.operations; // ["sign", "verify"]

// Export to different formats
const jwk = key.export("jwk"); // RFC 7517 JSON Web Key (private included)
const pem = key.export("pem"); // { privateKey, publicKey } PEM strings
const b64 = key.export("b64"); // { privateKey, publicKey } base64 strings
const der = key.export("der"); // { privateKey, publicKey } as Buffers

// Compact "kryptos:..." blob for environment variables
const envBlob = KryptosKit.env.export(key);
```

`KryptosKit.generate.auto` picks a sensible type, curve and modulus for any
supported JOSE algorithm:

```ts
KryptosKit.generate.auto({ algorithm: "ES256" });
KryptosKit.generate.auto({ algorithm: "EdDSA" });
KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });

// Async variants exist for every generator (RSA keygen is CPU-heavy)
await KryptosKit.generateAsync.auto({ algorithm: "RS256" });
await KryptosKit.generateAsync.sig.ec({ algorithm: "ES256" });
```

All generators accept optional metadata:

```ts
KryptosKit.generate.auto({
  algorithm: "ES256",
  id: "my-key-id",
  createdAt: new Date(),
  notBefore: new Date(),
  expiresAt: new Date("2027-12-31"),
  issuer: "https://auth.example.com",
  jwksUri: "https://auth.example.com/.well-known/jwks.json",
  ownerId: "tenant-42",
  purpose: "token", // "cookie" | "session" | "token" | string
  encryption: "A256GCM", // enc keys only — defaults to "A256GCM"
  hidden: false,
  isExternal: false,
});
```

### Import a key

```ts
// From a "kryptos:..." environment blob
const key = KryptosKit.env.import(process.env.EC_KEY!);

// From a JWK object (standard RFC 7517, or Lindorm-extended JWK with x5c)
const key2 = KryptosKit.from.jwk({ alg: "ES256", kty: "EC" /* ... */ });

// From a PEM string
const key3 = KryptosKit.from.pem({
  algorithm: "ES256",
  type: "EC",
  use: "sig",
  curve: "P-256",
  privateKey: "-----BEGIN PRIVATE KEY-----\n...",
});

// Auto-detect format
const key4 = KryptosKit.from.auto(unknownInput);
```

### Persist and restore

```ts
// Save to database
await db.collection("keys").insertOne(key.toDB());

// Restore from database
const restored = KryptosKit.from.db(row);
```

### Use the CLI

```bash
npx kryptos generate
# Answer a few prompts (type, use, algorithm, encryption, purpose)
# → prints a "kryptos:..." blob ready to paste into your .env file
```

---

## X.509 certificates

Any asymmetric key (EC, OKP or RSA — **not** oct) can be stamped with an X.509
certificate at generation time. Kryptos emits a chain that round-trips through
Node's `crypto.X509Certificate` and `@peculiar/x509`, and provides its own
RFC 5280-aware parser and verifier.

Three modes are supported:

### Self-signed leaf

```ts
const leaf = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  issuer: "https://issuer.example.com",
  notBefore: new Date("2026-01-01"),
  expiresAt: new Date("2027-01-01"),
  certificate: { mode: "self-signed" },
});

leaf.hasCertificate; // true
leaf.certificateChain; // ["<base64-DER>"] — single-entry
leaf.certificateThumbprint; // x5t#S256 (SHA-256, base64u)
leaf.certificate; // ParsedX509Certificate (lazy, cached)
```

A self-signed leaf has `cA=false`. Key usage is derived from `use`:

- `sig` keys → `digitalSignature`
- `enc` keys → `keyEncipherment`, `dataEncipherment`

SANs default from the key's `issuer` (URL → URI SAN, bare hostname → DNS SAN,
email → email SAN) or from `id` as a URN if no issuer is set. Override with
`subject`, `organization`, or `subjectAlternativeNames`:

```ts
certificate: {
  mode: "self-signed",
  subject: "api.example.com",
  organization: "Lindorm",
  subjectAlternativeNames: [
    { type: "dns", value: "api.example.com" },
    { type: "dns", value: "www.api.example.com" },
    { type: "uri", value: "https://api.example.com" },
  ],
}
```

### Root CA

```ts
const ca = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  issuer: "https://ca.example.com",
  notBefore: new Date("2026-01-01"),
  expiresAt: new Date("2036-01-01"),
  certificate: {
    mode: "root-ca",
    pathLengthConstraint: 1, // optional
  },
});
```

A root CA is self-signed with `cA=true`, `keyUsage = keyCertSign | cRLSign`,
and no AuthorityKeyIdentifier (SKI only).

### CA-signed child

```ts
// Pass the CA kryptos — it must carry its own private key and a cA=true cert
const child = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  issuer: "https://child.example.com",
  certificate: { mode: "ca-signed", ca },
});

child.certificateChain.length; // 2 — [child-DER, ca-DER]
child.verifyCertificate({ trustAnchors: [ca.certificateChain[0]] });
```

Child algorithms may differ from the CA (e.g. RSA child under an EC root).
The child's AKI is bound to the CA's SKI, issuer DN is copied byte-for-byte
from the CA's subject, and the signing algorithm is resolved from the CA
private key.

**Validity inheritance:** if you omit `notBefore` / `expiresAt` on a CA-signed
child, it inherits the CA's window automatically — so the natural idiom below
just works without pinning dates:

```ts
const ca = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  issuer: "https://ca.example.com",
  certificate: { mode: "root-ca" },
});
const child = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  issuer: "https://child.example.com",
  certificate: { mode: "ca-signed", ca },
});
child.verifyCertificate({ trustAnchors: [ca.certificateChain[0]] });
```

Explicit `notBefore` / `expiresAt` on the child still win, but are rejected at
stamp time if they fall outside the CA's window.

### Verification

```ts
child.verifyCertificate({ trustAnchors: [caLeafBase64Der] });
// or:
child.verifyCertificate({ trustAnchors: caLeafBase64Der });
```

Throws `KryptosError` on any failure (signature mismatch, window violation,
unknown issuer, missing `keyCertSign` on an intermediate, etc.).

### JWK integration

`toJWK()` automatically includes the chain in RFC 7517 fields when a
certificate is present:

```ts
const jwk = key.toJWK("public");
// {
//   kid, alg, kty, use, key_ops,                 <- standard JWK
//   enc, exp, iat, iss, jku, nbf, owner_id,      <- Lindorm extensions
//   purpose,
//   x5c: ["<base64-DER>", ...],                  <- certificate chain
//   "x5t#S256": "<base64u-SHA-256-of-leaf>",     <- RFC 7517 §4.8
//   ...key material
// }
```

`KryptosKit.from.jwk` refuses to import a JWK whose `x5t#S256` does not match
the recomputed leaf hash — catching tampered or mis-paired chains at the
boundary.

---

## Supported algorithms

### EC (Elliptic Curve)

| Use        | Algorithms                                                                                                                     | Curves              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Signature  | `ES256`, `ES384`, `ES512`                                                                                                      | P-256, P-384, P-521 |
| Encryption | `ECDH-ES`, `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW`, `ECDH-ES+A128GCMKW`, `ECDH-ES+A192GCMKW`, `ECDH-ES+A256GCMKW` | P-256, P-384, P-521 |

### OKP (Octet Key Pair)

| Use        | Algorithms                                                                                                                     | Curves         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| Signature  | `EdDSA`                                                                                                                        | Ed25519, Ed448 |
| Encryption | `ECDH-ES`, `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW`, `ECDH-ES+A128GCMKW`, `ECDH-ES+A192GCMKW`, `ECDH-ES+A256GCMKW` | X25519, X448   |

### RSA

| Use        | Algorithms                                                 | Modulus sizes          |
| ---------- | ---------------------------------------------------------- | ---------------------- |
| Signature  | `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512`       | 1024, 2048, 3072, 4096 |
| Encryption | `RSA-OAEP`, `RSA-OAEP-256`, `RSA-OAEP-384`, `RSA-OAEP-512` | 1024, 2048, 3072, 4096 |

### oct (Symmetric)

| Use        | Algorithms                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Signature  | `HS256`, `HS384`, `HS512`                                                                                                                    |
| Encryption | `A128KW`, `A192KW`, `A256KW`, `A128GCMKW`, `A192GCMKW`, `A256GCMKW`, `PBES2-HS256+A128KW`, `PBES2-HS384+A192KW`, `PBES2-HS512+A256KW`, `dir` |

> oct keys cannot be stamped with certificates — attempting it throws
> `"symmetric keys cannot have certificates"`.

---

## API reference

### Import / export

**Export formats:**

| Format | Method              | Returns                                      |
| ------ | ------------------- | -------------------------------------------- |
| JWK    | `key.export("jwk")` | `KryptosJwk` — standard JWK object           |
| PEM    | `key.export("pem")` | `{ privateKey?, publicKey? }` PEM strings    |
| Base64 | `key.export("b64")` | `{ privateKey?, publicKey? }` base64 strings |
| DER    | `key.export("der")` | `{ privateKey?, publicKey? }` Buffers        |

**Import methods:**

```ts
KryptosKit.from.jwk(jwkObject); // from RFC 7517 JWK (validates x5t#S256 if x5c is present)
KryptosKit.from.pem(options); // from PEM string
KryptosKit.from.b64(options); // from base64-encoded DER
KryptosKit.from.der(options); // from DER Buffer
KryptosKit.from.utf(options); // from UTF-8 string (oct keys)
KryptosKit.from.db(dbRow); // from a toDB() row
KryptosKit.from.auto(unknown); // auto-detect format
```

**Environment strings:**

```ts
const envBlob = KryptosKit.env.export(key); // "kryptos:<b64u(JWK)>"
const parsed = KryptosKit.env.import(process.env.MY_KEY!);
```

The env blob is the private JWK (including `x5c` / `x5t#S256` if any),
base64url-encoded and prefixed with `kryptos:`.

### Metadata and lifecycle

```ts
key.id; // UUID v4
key.algorithm; // "ES256", "RSA-OAEP", etc.
key.type; // "EC" | "OKP" | "RSA" | "oct"
key.use; // "sig" | "enc"
key.curve; // "P-256", "Ed25519", etc. (null for RSA/oct)
key.modulus; // 1024 | 2048 | 3072 | 4096 (null for non-RSA)
key.encryption; // AES encryption algorithm (enc keys only)
key.operations; // ["sign","verify"], ["wrapKey","unwrapKey"], etc.

// Lifecycle
key.createdAt; // Date
key.notBefore; // Date — key is not valid before this
key.expiresAt; // Date — defaults to notBefore + 25 years
key.isActive; // true if now >= notBefore && not expired
key.isExpired; // true if past expiresAt
key.expiresIn; // seconds until expiry

// Ownership / classification
key.issuer; // string | null
key.jwksUri; // string | null
key.ownerId; // string | null
key.purpose; // "cookie" | "session" | "token" | string | null
key.hidden; // boolean
key.isExternal; // boolean

// Key / cert presence
key.hasPrivateKey; // boolean
key.hasPublicKey; // boolean
key.hasCertificate; // boolean
key.thumbprint; // RFC 7638 JWK thumbprint
key.certificate; // ParsedX509Certificate | null (lazy-parsed leaf)
key.certificateChain; // Array<base64-DER> (leaf → root order)
key.certificateThumbprint; // x5t#S256 of the leaf
```

`Kryptos` instances are **immutable** — mutate-and-save flows go through
`KryptosKit.clone(...)`.

### Serialisation

```ts
key.toDB();        // KryptosDB — keys as base64, dates as Date objects
key.toJSON();      // KryptosJSON — attributes + computed flags, no key material
key.toJWK(mode?);  // LindormJwk — extended JWK (default: "public")
key.toEnvString(); // "kryptos:<base64u(private JWK)>"
key.toString();    // "Kryptos<EC:ES512:uuid>"
```

### Type guards

```ts
import { KryptosKit } from "@lindorm/kryptos";
import type { IKryptosEc, IKryptosRsa } from "@lindorm/kryptos";

if (KryptosKit.isEc(key)) {
  key.curve; /* narrowed to EcCurve */
}
if (KryptosKit.isOkp(key)) {
  /* ... */
}
if (KryptosKit.isRsa(key)) {
  /* ... */
}
if (KryptosKit.isOct(key)) {
  /* ... */
}
```

### Cloning

```ts
const copy = KryptosKit.clone(key, { expiresAt: new Date("2028-06-01") });
// New UUID, same key material, overridden metadata
```

### Secure disposal

`Kryptos` implements the TC39 Explicit Resource Management protocol:

```ts
// Manual disposal — zeroes out private & public key buffers
key.dispose();

// Or use the `using` keyword
{
  using key = KryptosKit.generate.auto({ algorithm: "ES256" });
  // ... use key ...
} // automatically disposed here
```

After disposal, any method that accesses key material throws `KryptosError`.

---

## Testing helpers

A factory and a full set of static key fixtures are exposed under the
`@lindorm/kryptos/mocks` subpath (also re-exported from the package root):

```ts
import {
  createMockKryptos,
  MOCK_KRYPTOS_EC_SIG_ES256,
  MOCK_KRYPTOS_EC_SIG_ES384,
  MOCK_KRYPTOS_EC_SIG_ES512,
  MOCK_KRYPTOS_EC_ENC,
  MOCK_KRYPTOS_OKP_SIG_ED25519,
  MOCK_KRYPTOS_OKP_SIG_ED448,
  MOCK_KRYPTOS_OKP_ENC_X25519,
  MOCK_KRYPTOS_OKP_ENC_X448,
  MOCK_KRYPTOS_RSA_SIG_RS256,
  MOCK_KRYPTOS_RSA_SIG_RS384,
  MOCK_KRYPTOS_RSA_SIG_RS512,
  MOCK_KRYPTOS_RSA_SIG_PS256,
  MOCK_KRYPTOS_RSA_SIG_PS384,
  MOCK_KRYPTOS_RSA_SIG_PS512,
  MOCK_KRYPTOS_RSA_ENC,
  MOCK_KRYPTOS_OCT_SIG_HS256,
  MOCK_KRYPTOS_OCT_SIG_HS384,
  MOCK_KRYPTOS_OCT_SIG_HS512,
  MOCK_KRYPTOS_OCT_ENC,
} from "@lindorm/kryptos/mocks";

// Fully-mocked IKryptos — every method is a jest.fn()
const mock = createMockKryptos({ algorithm: "ES256" });
```

Static mocks are real `IKryptos` instances built from pinned key material —
use them anywhere you want deterministic keys without paying keygen cost.

---

## License

AGPL-3.0-or-later
