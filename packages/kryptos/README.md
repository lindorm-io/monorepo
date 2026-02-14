# @lindorm/kryptos

Swiss-army-knife for **JWK / PEM / DER / raw** key management with first-class
TypeScript support. `@lindorm/kryptos` lets you _generate_, _import_, _convert_
and _store_ cryptographic keys (EC, OKP, RSA, oct) without remembering a single
OpenSSL command.

It includes:

- A powerful `Kryptos` model with rich metadata & lifetime helpers
- `KryptosKit` -- fluent factory / utility wrapper
- An interactive **CLI** (`kryptos generate`) for one-off keys
- Secure key disposal via the TC39 `Disposable` protocol

---

## Installation

```bash
npm install @lindorm/kryptos
# or
yarn add @lindorm/kryptos

# optional -- install the CLI globally
npm install -g @lindorm/kryptos
```

Requires Node >= 18 for the native `crypto` APIs.

---

## Quick start

### Generate a key

```ts
import { KryptosKit } from "@lindorm/kryptos";

// Create a P-521 EC signing key (ES512)
const key = KryptosKit.generate.sig.ec({ algorithm: "ES512" });

console.log(key.id);        // UUID v4
console.log(key.algorithm); // "ES512"
console.log(key.type);      // "EC"
console.log(key.curve);     // "P-521"
console.log(key.use);       // "sig"
console.log(key.operations); // ["sign", "verify"]

// Export to different formats
const jwk = key.export("jwk"); // RFC 7517 JSON Web Key (private included)
const pem = key.export("pem"); // { privateKey: "-----BEGIN ...", publicKey: "-----BEGIN ..." }
const b64 = key.export("b64"); // { privateKey: "<base64>", publicKey: "<base64>" }
const der = key.export("der"); // { privateKey: Buffer, publicKey: Buffer }

// Export to compact env string (base64u-encoded JWK prefixed with "kryptos:")
const envBlob = KryptosKit.env.export(key);
```

### Import a key

```ts
import { KryptosKit } from "@lindorm/kryptos";

// From an environment variable
const key = KryptosKit.env.import(process.env.EC_KEY!);

// From a JWK object
const key2 = KryptosKit.from.jwk({ alg: "ES256", kty: "EC", ... });

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
# Answer a few questions (type, use, algorithm, encryption, purpose)
# -> A "kryptos:..." blob ready to paste into your .env file
```

---

## Supported algorithms

### EC (Elliptic Curve)

| Use | Algorithms | Curves |
|-----|-----------|--------|
| Signature | `ES256`, `ES384`, `ES512` | P-256, P-384, P-521 |
| Encryption | `ECDH-ES`, `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW`, `ECDH-ES+A128GCMKW`, `ECDH-ES+A192GCMKW`, `ECDH-ES+A256GCMKW` | P-256, P-384, P-521 |

### OKP (Octet Key Pair)

| Use | Algorithms | Curves |
|-----|-----------|--------|
| Signature | `EdDSA` | Ed25519, Ed448 |
| Encryption | `ECDH-ES`, `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW`, `ECDH-ES+A128GCMKW`, `ECDH-ES+A192GCMKW`, `ECDH-ES+A256GCMKW` | X25519, X448 |

### RSA

| Use | Algorithms | Modulus sizes |
|-----|-----------|---------------|
| Signature | `RS256`, `RS384`, `RS512`, `PS256`, `PS384`, `PS512` | 1024, 2048, 3072, 4096 |
| Encryption | `RSA-OAEP`, `RSA-OAEP-256`, `RSA-OAEP-384`, `RSA-OAEP-512` | 1024, 2048, 3072, 4096 |

### oct (Symmetric)

| Use | Algorithms |
|-----|-----------|
| Signature | `HS256`, `HS384`, `HS512` |
| Encryption | `A128KW`, `A192KW`, `A256KW`, `A128GCMKW`, `A192GCMKW`, `A256GCMKW`, `PBES2-HS256+A128KW`, `PBES2-HS384+A192KW`, `PBES2-HS512+A256KW`, `dir` |

---

## API reference

### Key generation

```ts
// Auto-generate from any JOSE algorithm -- picks type, curve, and key size for you
KryptosKit.generate.auto({ algorithm: "ES256" });
KryptosKit.generate.auto({ algorithm: "EdDSA" });
KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });

// Explicit: generate.<use>.<type>(options)
KryptosKit.generate.sig.ec({ algorithm: "ES512" });
KryptosKit.generate.sig.rsa({ algorithm: "PS256" });
KryptosKit.generate.enc.okp({ algorithm: "ECDH-ES", curve: "X25519" });
KryptosKit.generate.enc.oct({ algorithm: "A256KW" });

// Async variants (same API, returns Promise<IKryptos>)
await KryptosKit.generateAsync.auto({ algorithm: "RS256" });
await KryptosKit.generateAsync.sig.ec({ algorithm: "ES256" });
```

All generation methods accept optional metadata:

```ts
KryptosKit.generate.auto({
  algorithm: "ES256",
  expiresAt: new Date("2025-12-31"),
  issuer: "https://auth.example.com",
  ownerId: "tenant-42",
  purpose: "token",   // "cookie" | "session" | "token"
  encryption: "A256GCM", // for enc keys -- default "A256GCM"
});
```

### Import / export

**Export formats:**

| Format | Method | Returns |
|--------|--------|---------|
| JWK | `key.export("jwk")` | `KryptosJwk` -- standard JWK object |
| PEM | `key.export("pem")` | `KryptosString` -- `{ privateKey?, publicKey? }` as PEM strings |
| Base64 | `key.export("b64")` | `KryptosString` -- `{ privateKey?, publicKey? }` as base64 strings |
| DER | `key.export("der")` | `KryptosBuffer` -- `{ privateKey?, publicKey? }` as Buffers |

**Import methods:**

```ts
KryptosKit.from.jwk(jwkObject);    // from RFC 7517 JWK
KryptosKit.from.pem(options);      // from PEM string
KryptosKit.from.b64(options);      // from base64-encoded key
KryptosKit.from.der(options);      // from DER Buffer
KryptosKit.from.utf(options);      // from UTF-8 string (oct keys)
KryptosKit.from.db(dbRow);         // from database record (toDB() output)
KryptosKit.from.auto(unknown);     // auto-detect format
```

**Environment strings:**

```ts
// Export: produces "kryptos:<base64u-encoded-jwk>"
const envBlob = KryptosKit.env.export(key);

// Import: parses "kryptos:..." back into an IKryptos instance
const key = KryptosKit.env.import(process.env.MY_KEY!);
```

### Extended JWK (Lindorm JWK)

`toJWK()` produces a superset of a standard JWK, adding lifecycle and ownership fields:

```ts
const jwk = key.toJWK("public"); // or "private"
// {
//   kid, alg, kty, use, key_ops,   <-- standard JWK fields
//   enc, exp, iat, iss, jku,        <-- Lindorm extensions
//   nbf, owner_id, purpose, uat,
//   ...key material
// }
```

### Metadata and lifecycle

```ts
key.id;            // UUID v4
key.algorithm;     // "ES256", "RSA-OAEP", etc.
key.type;          // "EC" | "OKP" | "RSA" | "oct"
key.use;           // "sig" | "enc"
key.curve;         // "P-256", "Ed25519", etc. (null for RSA/oct)
key.modulus;       // 1024 | 2048 | 3072 | 4096 (null for non-RSA)
key.encryption;    // AES encryption algorithm (enc keys only)
key.operations;    // ["sign","verify"], ["wrapKey","unwrapKey"], etc.

// Lifecycle
key.createdAt;     // Date
key.updatedAt;     // Date
key.notBefore;     // Date  -- key is not valid before this
key.expiresAt;     // Date | null
key.isActive;      // true if now >= notBefore && not expired
key.isExpired;     // true if past expiresAt
key.expiresIn;     // seconds until expiry (-1 = no expiry, 0 = expired)

// Ownership
key.issuer;        // string | null
key.jwksUri;       // string | null
key.ownerId;       // string | null
key.purpose;       // "cookie" | "session" | "token" | null
key.hidden;        // boolean
key.isExternal;    // boolean

// Key presence
key.hasPrivateKey; // boolean
key.hasPublicKey;  // boolean
```

Setters on mutable fields (`expiresAt`, `encryption`, `hidden`, `issuer`, `jwksUri`,
`notBefore`, `operations`, `ownerId`, `purpose`) automatically update `updatedAt`.

### Serialisation

```ts
key.toDB();        // KryptosDB -- keys as base64, dates as Date objects; safe for SQL/NoSQL
key.toJSON();      // KryptosJSON -- all attributes + computed metadata (no key material)
key.toJWK(mode?);  // LindormJwk -- extended JWK (default: "public")
key.toEnvString(); // "kryptos:<base64u>" -- compact string for .env files
key.toString();    // "Kryptos<EC:ES512:uuid>"
```

### Type guards

```ts
import { KryptosKit } from "@lindorm/kryptos";
import type { IKryptosEc, IKryptosRsa } from "@lindorm/kryptos";

if (KryptosKit.isEc(key)) {
  key.curve; // narrowed to EcCurve
}
if (KryptosKit.isOkp(key)) { /* ... */ }
if (KryptosKit.isRsa(key)) { /* ... */ }
if (KryptosKit.isOct(key)) { /* ... */ }
```

### Cloning

```ts
const copy = KryptosKit.clone(key, { expiresAt: new Date("2026-06-01") });
// New UUID, same key material, overridden metadata
```

### Secure disposal

Kryptos implements `Disposable` (TC39 Explicit Resource Management):

```ts
// Manual disposal -- fills key buffers with zeros
key.dispose();

// Or use the "using" keyword (TypeScript 5.2+)
{
  using key = KryptosKit.generate.auto({ algorithm: "ES256" });
  // ... use key ...
} // automatically disposed here
```

After disposal, any method that accesses key material will throw `KryptosError`.

---

## Testing helpers

A mock factory is exported for unit tests:

```ts
import { createMockKryptos } from "@lindorm/kryptos";

const mock = createMockKryptos();
```

---

## License

AGPL-3.0-or-later
