# @lindorm/kryptos

Generate, import, convert, certify, and dispose JOSE / X.509 cryptographic keys (EC, OKP, RSA, oct, AKP) from a single TypeScript model.

## Installation

```bash
npm install @lindorm/kryptos
```

The CLI ships in the same package via the `kryptos` bin — install globally if you want it on `PATH`:

```bash
npm install -g @lindorm/kryptos
```

This package is **ESM-only**. It cannot be loaded with `require(...)`. Use `import` syntax in an ESM project (`"type": "module"` or `.mjs`).

## Features

- A `Kryptos` model carrying key material, RFC 7517 / RFC 7638 metadata, and lifetime fields (`notBefore` / `expiresAt` / `isActive`).
- `KryptosKit` — a static facade for generating, importing, cloning, and type-narrowing keys.
- Sync and async generators for every supported JOSE algorithm, plus an algorithm-only `auto` shortcut that picks a sensible curve / modulus.
- Multi-format export (`jwk`, `pem`, `b64`, `der`) and import (`jwk`, `pem`, `b64`, `der`, `utf`, `db`, `auto`).
- Compact `kryptos:<base64url-JWK>` env-string format with matching importer.
- Built-in X.509 certificate stamping at generation time — self-signed, root-CA, or CA-signed — with chain verification against trust anchors.
- Secure key disposal via the TC39 Explicit Resource Management protocol (`Symbol.dispose`, `using`).
- Interactive CLI (`kryptos generate`) for one-off env-ready keys.
- Subpath exports for Jest and Vitest mock factories and a set of pinned static key fixtures.

## Quick start

### Generate a key

```ts
import { KryptosKit } from "@lindorm/kryptos";

const key = KryptosKit.generate.sig.ec({ algorithm: "ES512" });

key.id; // UUID
key.algorithm; // "ES512"
key.type; // "EC"
key.curve; // "P-521"
key.use; // "sig"
key.operations; // ["sign", "verify"]

const jwk = key.export("jwk");
const pem = key.export("pem");
const b64 = key.export("b64");
const der = key.export("der");

const envBlob = KryptosKit.env.export(key);
```

`KryptosKit.generate.auto` picks a sensible type, curve, and (for asymmetric encryption) AES content encryption based on the JOSE algorithm alone:

```ts
KryptosKit.generate.auto({ algorithm: "ES256" });
KryptosKit.generate.auto({ algorithm: "EdDSA" });
KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });
KryptosKit.generate.auto({ algorithm: "ML-DSA-65" });

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
  purpose: "token",
  encryption: "A256GCM",
  hidden: false,
  isExternal: false,
});
```

When `expiresAt` is omitted it defaults to `notBefore` plus 25 years. When `use` is `"enc"` and `encryption` is omitted it defaults to `"A256GCM"`.

### Import a key

```ts
const fromEnv = KryptosKit.env.import(process.env.EC_KEY!);

const fromJwk = KryptosKit.from.jwk({ alg: "ES256", kty: "EC" /* ... */ });

const fromPem = KryptosKit.from.pem({
  algorithm: "ES256",
  type: "EC",
  use: "sig",
  curve: "P-256",
  privateKey: "-----BEGIN PRIVATE KEY-----\n...",
});

const auto = KryptosKit.from.auto(unknownInput);
```

### Persist and restore

```ts
await db.collection("keys").insertOne(key.toDB());

const restored = KryptosKit.from.db(row);
```

### Use the CLI

```bash
npx kryptos generate
```

Answer the prompts (type, use, algorithm, encryption, purpose) and the CLI prints a `kryptos:...` blob ready to paste into a `.env` file. Re-import it at runtime with `KryptosKit.env.import(process.env.MY_KEY!)`.

## X.509 certificates

Any asymmetric key (`EC`, `OKP`, `RSA`, `AKP`) can be stamped with an X.509 certificate at generation time. Symmetric `oct` keys cannot — attempting it throws `KryptosError("symmetric keys cannot have certificates")`. Three modes are supported.

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
leaf.certificateThumbprint; // x5t#S256 (SHA-256 over the leaf DER)
leaf.certificate; // ParsedX509Certificate (lazy, cached)
```

A self-signed leaf has `cA=false`. Key usage is derived from `use`: `sig` keys get `digitalSignature`, `enc` keys get `keyEncipherment` and `dataEncipherment`. If `subjectAlternativeNames` is omitted, a single URI SAN is derived from the key's `issuer` when it is URL-shaped, or `urn:lindorm:kryptos:<id>` when no issuer is set. A non-URL issuer with no explicit SANs throws — supply `subjectAlternativeNames` (or a URL issuer) in that case. Override with `subject`, `organization`, or `subjectAlternativeNames`:

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
    pathLengthConstraint: 1,
  },
});
```

A root CA is self-signed with `cA=true`, `keyUsage = keyCertSign | cRLSign`, no AuthorityKeyIdentifier (SKI only).

### CA-signed child

```ts
const child = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  issuer: "https://child.example.com",
  certificate: { mode: "ca-signed", ca },
});

child.certificateChain.length; // 2 — [child-DER, ca-DER]
child.verifyCertificate({ trustAnchors: [ca.certificateChain[0]] });
```

The child algorithm may differ from the CA (e.g. RSA child under an EC root). The child's AKI is bound to the CA's SKI, the issuer DN is copied byte-for-byte from the CA's subject, and the signing algorithm is resolved from the CA's private key.

If `notBefore` / `expiresAt` are omitted on a CA-signed child, the child inherits the CA's window — so the natural idiom of generating a CA and then a child without pinning dates "just works". Explicit dates still win, but are rejected at stamp time if they fall outside the CA's window.

### Verification

```ts
child.verifyCertificate({ trustAnchors: [caLeafBase64Der] });
child.verifyCertificate({ trustAnchors: caLeafBase64Der });
```

Throws `KryptosError` on any failure (signature mismatch, validity-window violation, unknown issuer, missing `keyCertSign` on an intermediate, etc.).

### JWK integration

`toJWK()` automatically includes the chain in RFC 7517 fields when a certificate is present:

```ts
const jwk = key.toJWK("public");
// {
//   kid, alg, kty, use, key_ops,                <- standard JWK
//   enc, exp, iat, iss, jku, nbf, owner_id,     <- Lindorm extensions
//   purpose,
//   x5c: ["<base64-DER>", ...],                 <- certificate chain (leaf -> root)
//   "x5t#S256": "<base64u-SHA-256-of-leaf>",    <- RFC 7517 §4.8
//   ...key material
// }
```

`KryptosKit.from.jwk` rejects a JWK whose incoming `x5t#S256` does not match the recomputed leaf hash, catching tampered or mis-paired chains at the boundary.

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

### AKP (Algorithm Key Pair — post-quantum)

| Use       | Algorithms                            |
| --------- | ------------------------------------- |
| Signature | `ML-DSA-44`, `ML-DSA-65`, `ML-DSA-87` |

AKP is signature-only — there is no `KryptosKit.generate.enc.akp`.

## API reference

### `Kryptos`

The model class. Construct directly only if you already have raw key material — most callers go through `KryptosKit`. Implements `IKryptos`, `Disposable`.

| Member                                       | Description                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `id`                                         | UUID (or whatever string was passed in `options.id`).                                 |
| `algorithm`                                  | JOSE algorithm name.                                                                  |
| `type`                                       | `"EC" \| "OKP" \| "RSA" \| "oct" \| "AKP"`.                                           |
| `use`                                        | `"sig" \| "enc"`.                                                                     |
| `curve`                                      | EC / OKP curve, otherwise `null`.                                                     |
| `modulus`                                    | RSA modulus size in bits, otherwise `null`.                                           |
| `encryption`                                 | AES content encryption (`enc` keys), otherwise `null`.                                |
| `operations`                                 | `key_ops` — derived from `algorithm` + `use` if not explicitly supplied.              |
| `createdAt` / `notBefore` / `expiresAt`      | Lifetime dates. `expiresAt` defaults to `notBefore + 25y`.                            |
| `expiresIn`                                  | Seconds until expiry, `0` once expired.                                               |
| `isActive` / `isExpired`                     | Computed from `notBefore` / `expiresAt` against the current time.                     |
| `issuer` / `jwksUri` / `ownerId` / `purpose` | Optional metadata, default `null`.                                                    |
| `hidden` / `isExternal`                      | Boolean flags, default `false`.                                                       |
| `hasPrivateKey` / `hasPublicKey`             | Whether the underlying buffers are present and non-empty.                             |
| `thumbprint`                                 | RFC 7638 JWK thumbprint computed lazily.                                              |
| `hasCertificate`                             | Whether an X.509 chain was attached.                                                  |
| `certificate`                                | `ParsedX509Certificate` for the leaf (lazy, cached), or `null`.                       |
| `certificateChain`                           | `Array<string>` of base64-DER certs in leaf-to-root order.                            |
| `certificateThumbprint`                      | x5t#S256 of the leaf, or `null`.                                                      |
| `verifyCertificate({ trustAnchors })`        | Walks the chain, verifies signatures and validity windows; throws on failure.         |
| `export("b64" \| "der" \| "jwk" \| "pem")`   | Returns key material in the requested format.                                         |
| `toDB()`                                     | Database row — attributes plus base64 `privateKey` / `publicKey`.                     |
| `toEnvString()`                              | Compact `kryptos:<base64url-private-JWK>` blob.                                       |
| `toJSON()`                                   | Attributes plus computed flags, no key material.                                      |
| `toJWK(mode?)`                               | Lindorm-extended JWK; `mode` defaults to `"public"`, pass `"private"` to include `d`. |
| `toString()`                                 | `Kryptos<{type}:{algorithm}:{id}>`.                                                   |
| `dispose()` / `[Symbol.dispose]()`           | Zero-fills key buffers; further key access throws `KryptosError`.                     |

`Kryptos` instances are immutable — to change metadata, clone via `KryptosKit.clone(...)`.

### `KryptosKit`

A static-only facade. Every method below is `KryptosKit.<member>`.

#### Generation

| Member                   | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `generate.auto(opts)`    | Pick `type` / `curve` / `encryption` from `opts.algorithm`. |
| `generate.sig.akp(opts)` | Generate an AKP signing key.                                |
| `generate.sig.ec(opts)`  | Generate an EC signing key.                                 |
| `generate.sig.oct(opts)` | Generate an oct (HMAC) signing key.                         |
| `generate.sig.okp(opts)` | Generate an OKP signing key.                                |
| `generate.sig.rsa(opts)` | Generate an RSA signing key.                                |
| `generate.enc.ec(opts)`  | Generate an EC encryption key.                              |
| `generate.enc.oct(opts)` | Generate an oct encryption key.                             |
| `generate.enc.okp(opts)` | Generate an OKP encryption key.                             |
| `generate.enc.rsa(opts)` | Generate an RSA encryption key.                             |
| `generateAsync.*`        | Same shape as `generate.*`, returning `Promise<IKryptos>`.  |

#### Import

| Member             | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| `from.auto(input)` | Auto-detect b64 / der / jwk / pem.                                              |
| `from.b64(opts)`   | Construct from base64-encoded DER.                                              |
| `from.db(row)`     | Construct from a `toDB()` row.                                                  |
| `from.der(opts)`   | Construct from DER `Buffer`s.                                                   |
| `from.jwk(opts)`   | Construct from an RFC 7517 JWK (validates `x5t#S256` against `x5c` if present). |
| `from.pem(opts)`   | Construct from PEM strings.                                                     |
| `from.utf(opts)`   | Construct an oct key from a UTF-8 string.                                       |

#### Env strings

| Member                | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `env.export(kryptos)` | Returns `kryptos:<base64url(private LindormJwk)>`.                      |
| `env.import(string)`  | Parses a `kryptos:` blob back into an `IKryptos`. Throws on bad prefix. |

#### Type guards

| Member           | Narrows to                       |
| ---------------- | -------------------------------- |
| `isAkp(kryptos)` | `IKryptosAkp` (`type === "AKP"`) |
| `isEc(kryptos)`  | `IKryptosEc` (`type === "EC"`)   |
| `isOct(kryptos)` | `IKryptosOct` (`type === "oct"`) |
| `isOkp(kryptos)` | `IKryptosOkp` (`type === "OKP"`) |
| `isRsa(kryptos)` | `IKryptosRsa` (`type === "RSA"`) |

#### Other

| Member                           | Description                                                            |
| -------------------------------- | ---------------------------------------------------------------------- |
| `clone(kryptos, overrides?)`     | New `Kryptos` with the same key material, fresh UUID, merged metadata. |
| `getTypeForAlgorithm(algorithm)` | Returns the `KryptosType` that auto-config would pick.                 |

### Errors

All errors thrown by the library are instances of `KryptosError`, which extends `LindormError` from `@lindorm/errors`.

```ts
import { KryptosError } from "@lindorm/kryptos";
```

### Cloning

```ts
const copy = KryptosKit.clone(key, { expiresAt: new Date("2028-06-01") });
```

`clone` produces a new instance with a new UUID, the same exported DER key material, and any overrides merged on top of the source attributes.

### Secure disposal

`Kryptos` implements TC39 Explicit Resource Management:

```ts
key.dispose();

{
  using key = KryptosKit.generate.auto({ algorithm: "ES256" });
  // ... use key ...
} // automatically disposed at scope exit
```

Disposal zero-fills the underlying private and public key buffers. Any subsequent method that needs key material throws `KryptosError("Key has been disposed")`.

## CLI

The package installs a `kryptos` bin (`@lindorm/kryptos` exposes it as `dist/cli.js`).

```bash
kryptos generate
```

Prompts for type, use, algorithm, encryption (for `enc` keys), and an optional purpose, then prints both the `kryptos:` env blob and a one-liner showing how to import it.

## Testing helpers

Two ESM subpaths expose mock factories matched to your test runner:

```ts
// Vitest
import { createMockKryptos } from "@lindorm/kryptos/mocks/vitest";

// Jest
import { createMockKryptos } from "@lindorm/kryptos/mocks/jest";

const mock = createMockKryptos({ algorithm: "ES256" });
// fully-typed `Mocked<IKryptos>` — every method is a mock fn,
// every getter has a deterministic default. Override any field via the argument.
```

A separate subpath ships pinned static key fixtures — real `IKryptos` instances built from frozen test material. Use them anywhere you want deterministic keys without paying keygen cost:

```ts
import {
  KRYPTOS_AKP_SIG_ML_DSA_44,
  KRYPTOS_AKP_SIG_ML_DSA_65,
  KRYPTOS_AKP_SIG_ML_DSA_87,
  KRYPTOS_EC_SIG_ES256,
  KRYPTOS_EC_SIG_ES384,
  KRYPTOS_EC_SIG_ES512,
  KRYPTOS_EC_ENC,
  KRYPTOS_OCT_SIG_HS256,
  KRYPTOS_OCT_SIG_HS384,
  KRYPTOS_OCT_SIG_HS512,
  KRYPTOS_OCT_ENC,
  KRYPTOS_OKP_SIG_ED25519,
  KRYPTOS_OKP_SIG_ED448,
  KRYPTOS_OKP_ENC_X25519,
  KRYPTOS_OKP_ENC_X448,
  KRYPTOS_RSA_SIG_RS256,
  KRYPTOS_RSA_SIG_RS384,
  KRYPTOS_RSA_SIG_RS512,
  KRYPTOS_RSA_SIG_PS256,
  KRYPTOS_RSA_SIG_PS384,
  KRYPTOS_RSA_SIG_PS512,
  KRYPTOS_RSA_ENC,
} from "@lindorm/kryptos/fixtures";
```

These subpaths are intended for test code and are not re-exported from the package root.

## License

AGPL-3.0-or-later
