# @lindorm/aegis

JOSE token operations for JWT, JWS, and JWE backed by an Amphora key store.

## Installation

```bash
npm install @lindorm/aegis
```

This package is **ESM-only**. All examples use `import`; `require()` is not supported.

The `Aegis` class requires `@lindorm/amphora` (key store) and `@lindorm/logger` (logger) instances at construction time:

```bash
npm install @lindorm/amphora @lindorm/logger
```

## Overview

Aegis exposes two layers:

- **`Aegis`** — async façade that resolves keys from an `IAmphora` key store and delegates to the kit classes. Use this when you want JWT/JWS/JWE or COSE/CWT operations driven by a managed key store with `kid`-based lookup.
- **Kit classes** (`JwtKit`, `JwsKit`, `JweKit`, `SignatureKit`) — synchronous, single-key primitives. You supply an `IKryptos` key directly. Use these when you already have the key in hand and don't need the Amphora layer.

The `Aegis` instance methods are async because they perform key lookups. All kit instance methods are synchronous.

## Aegis

```typescript
import { Aegis } from "@lindorm/aegis";

const aegis = new Aegis({
  amphora, // IAmphora — key store
  logger, // ILogger
  issuer: "https://example.com", // optional; falls back to amphora.domain
  clockTolerance: 30, // optional, in seconds (default 0)
  encryption: "A256GCM", // optional, default "A256GCM"
  certBindingMode: "strict", // optional, "strict" | "lax" (default "strict")
  dpopMaxSkew: 60, // optional, in seconds (default 60)

  // Deployment key policy — see "Key selection" below.
  sign: { predicate: { purpose: "token" } },
  encrypt: { predicate: { purpose: "token" } },
});
```

### Key selection

Key selection is one mechanism — a **predicate** — doing two strictly separate jobs.

- **Floor** — policy. Aegis's invariant for the operation, plus the artifact's own
  opinion (a profile's `algClass`). Enforced on **every** key that reaches the crypto
  layer: selected from the vault, named by a token's `kid`, or supplied outright.
- **Selector** — a vault query. "Which of _my_ keys." The deployment default merged
  with the per-call predicate (shallow; the caller's key wins). It is meaningless for
  a key that never came from the vault, so it is **not** applied to a supplied key.

The four floors are deliberately asymmetric:

| operation | floor                                                            |
| --------- | ---------------------------------------------------------------- |
| `sign`    | `{ use: "sig", hasPrivateKey: true }` + the profile's `algClass` |
| `verify`  | `{ use: "sig" }`                                                 |
| `encrypt` | `{ use: "enc" }` — a public half **or** an oct secret            |
| `decrypt` | `{ use: "enc", hasPrivateKey: true }`                            |

`hasPublicKey` is not the encrypt floor: an oct key has no public half, so requiring
one would break `dir` / `A*KW` encryption outright. `hasPrivateKey` on the decrypt
floor is what separates the two encryption directions — `ECDH-ES` reports the same
operations for both halves and can never tell them apart.

There is **no ranking and no fallback**. A key satisfies the policy or it does not,
and a miss throws — falling back to a key the policy forbids is how an unverifiable
token gets minted.

Every selector is amphora's `AmphoraKeySelector` — `{ kryptos?, predicate? }`, the one
key-selection vocabulary across the toolkit — narrowed to the attributes aegis permits.
`sign`, `encrypt` and `decrypt` take the full selector; `AegisEncKey` adds `encryption`,
which picks the cipher rather than the key. **`verify` deliberately carries no
`kryptos`**: a token names its verification key by `kid`, so there is no path that
supplies one, and the field would be surface nothing honours.

All four are accepted per call — as a **`key`** field on each operation's options
(`aegis.jws.sign`, `aegis.jwt.verify`, `aegis.aes.encrypt`, `aegis.aes.decrypt`,
`aegis.jwe.encrypt`/`decrypt`, …); `aegis.mint` takes two keys, so it nests them under
`sign` / `encrypt` sub-blocks (`{ sign: { key }, encrypt: { key } }`) — and as a
deployment default on `AegisSettings` (the nested `sign` / `encrypt` / `verify` / `decrypt`
above). The two merge shallowly, caller wins — except that an `undefined` caller value is
stripped, never applied, so it falls back to the deployment default rather than matching
every key.

```typescript
// Pin a key by id, or allowlist a set. `kid` is just `{ id }`.
// `idTokenSignedResponseAlg` is OPTIONAL client metadata: when the client
// registered none it is `undefined`, which is stripped — the key then resolves
// from the deployment default, NOT from "any key".
await aegis.mint("id_token", content, {
  sign: { key: { predicate: { algorithm: client.idTokenSignedResponseAlg } } },
});

// FAPI is deployment policy, not a key property — aegis publishes the list.
import { FAPI_SIG_ALGS } from "@lindorm/aegis";

await aegis.mint("id_token", content, {
  sign: { key: { predicate: { algorithm: { $in: FAPI_SIG_ALGS } } } },
});

// A key from outside the vault: an OIDC client secret IS the HS256 MAC key
// (Core §10.1). The profile floor still applies to it — the same key is
// accepted for an id_token and REJECTED for an access_token, which mandates
// an asymmetric signature.
await aegis.mint("id_token", content, {
  sign: {
    key: {
      kryptos: KryptosKit.from.utf({
        type: "oct",
        use: "sig",
        algorithm: "HS256",
        privateKey: client.secret,
      }),
    },
  },
});

// The read side. Selection follows the token's own `kid`, so a predicate is a
// CHECK on the resolved key, applied before the signature is touched — a token
// must not get to choose the class of key that verifies it (RFC 8725 §3.1).
const aegis = new Aegis({
  amphora,
  logger,
  verify: { predicate: { algClass: "asymmetric" } },
});
```

### Namespaced operations

```typescript
const signed = await aegis.jwt.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  audience: ["https://api.example.com"],
  scope: ["read", "write"],
  claims: { role: "admin" },
});

const parsed = await aegis.jwt.verify(signed.token, {
  audience: "https://api.example.com",
  scope: ["read"],
});

const jws = await aegis.jws.sign("payload");
const verifiedJws = await aegis.jws.verify(jws.token);

const jwe = await aegis.jwe.encrypt("secret");
const decrypted = await aegis.jwe.decrypt(jwe.token);
```

The COSE namespaces `cws` / `cwe` / `cwt` are the wire-for-wire COSE counterparts of `jws` / `jwe` / `jwt` — same surface, same key resolution, CBOR wire (see [COSE / CWT](#cose--cwt)):

```typescript
// cws — raw COSE_Sign1, the COSE mirror of jws (secures a CBOR claims map)
const cws = await aegis.cws.sign({ tid: "at_abc" }, { tokenType: "access_token" });
const parsedCws = await aegis.cws.verify(cws.token);

// cwe — COSE_Encrypt0, the COSE mirror of jwe (direct AEAD to a symmetric enc key)
const cwe = await aegis.cwe.encrypt("secret");
const decryptedCwe = await aegis.cwe.decrypt(cwe.token); // { payload: Buffer }

// cwt — generic CWT with standard claims, the COSE mirror of jwt
const cwt = await aegis.cwt.sign({
  subject: "user-123",
  audience: ["https://api.example.com"],
  expires: "1h",
});
const parsedCwt = await aegis.cwt.verify(cwt.token, {
  audience: "https://api.example.com",
});
```

### AES helpers

```typescript
const encoded = await aegis.aes.encrypt("data"); // base64 string
const record = await aegis.aes.encrypt("data", "record"); // AesEncryptionRecord
const serialised = await aegis.aes.encrypt("data", "serialised"); // SerialisedAesEncryption
const tokenised = await aegis.aes.encrypt("data", "tokenised"); // base64 string

const plain = await aegis.aes.decrypt(encoded);
```

AES takes the same [key selector](#key-selection) as every other operation — one Aegis
serves a whole deployment, so "encrypt this **cookie** with the internal cookie key" has
to be sayable next to "encrypt this **id_token** to the client's key". Without it the AES
path can only ask the deployment-wide enc policy, which hands back the newest _published_
key.

```typescript
// The internal cookie key. `publish: false` hides a key from SELECTION, not just
// from publication, so reaching for it is an explicit opt-in.
const cookie = await aegis.aes.encrypt(session, "encoded", {
  key: { predicate: { purpose: "cookie", publish: false } },
});

// The ciphertext names its own key, so the read side needs no selector — the
// lookup is unfiltered and still finds an expired or unpublished key.
const session = await aegis.aes.decrypt(cookie);

// `encryption` picks the CIPHER, never the key.
await aegis.aes.encrypt(data, "encoded", { key: { encryption: "A128CBC-HS256" } });
```

A key supplied outright is the one case the vault cannot serve on the way back, so
**decrypt takes a `kryptos` too** — encrypting with a detached key and being unable to
decrypt it again would otherwise be a silent one-way trip. The floor still applies, and a
supplied key that is not the one the ciphertext names throws (`decrypt_key_mismatch`)
rather than being quietly ignored.

```typescript
const encoded = await aegis.aes.encrypt(data, "encoded", { key: { kryptos: detached } });
const plain = await aegis.aes.decrypt(encoded, { key: { kryptos: detached } });
```

### Universal verification

`aegis.verify` auto-detects JWT, JWS, and JWE compact serialisations. JWE inputs are decrypted first, then the inner payload is re-verified. A COSE token (base64url CBOR, no JOSE dot structure) is also auto-detected and its integrity verified — see [COSE / CWT](#cose--cwt).

```typescript
const result = await aegis.verify(anyToken, {
  audience: "https://api.example.com",
});
```

### Static helpers

These do not need a key or amphora.

```typescript
Aegis.isJwt(token);
Aegis.isJws(token);
Aegis.isJwe(token);
Aegis.isJose(token); // any JOSE token (JWT, JWS, or JWE)
Aegis.isCose(token); // a COSE token (CWT / bare COSE object) — the other wire family

Aegis.header(token); // decode the header (JOSE segment, or the COSE protected map)
Aegis.decode(token); // auto-detect (JOSE or COSE), decode without verifying
Aegis.parse(token); // auto-detect (JWT or JWS), validate structure

Aegis.toDomain(wire); // wire claim dict → { claims, custom } domain claims
Aegis.toWire(claims); // domain claims → JOSE-keyed wire dict
Aegis.validateClaims(claims, matchers); // throws on mismatch
```

## JwtKit

Synchronous JWT sign and verify against a single `IKryptos` key.

```typescript
import { JwtKit } from "@lindorm/aegis";

const kit = new JwtKit({
  issuer: "https://example.com",
  kryptos,
  logger,
  clockTolerance: 30, // seconds, optional
});

const signed = kit.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  audience: ["https://api.example.com"],
  claims: { role: "admin" },
});
// → { token, expiresAt, expiresIn, expiresOn, objectId, tokenId }

const parsed = kit.verify(signed.token, {
  audience: "https://api.example.com",
  scope: ["read"],
});

JwtKit.isJwt(token);
JwtKit.decode(token);
JwtKit.parse(token);
JwtKit.validate(payload, matchers);
```

## JwsKit

Synchronous JWS sign and verify over arbitrary `string` or `Buffer` data.

```typescript
import { JwsKit } from "@lindorm/aegis";

const kit = new JwsKit({ kryptos, logger });

const signed = kit.sign("hello world", { objectId: "msg-001" });
// → { token, objectId }

const parsed = kit.verify<string>(signed.token);
// parsed.payload === "hello world"

JwsKit.isJws(token);
JwsKit.decode(token);
JwsKit.parse(token);
```

## JweKit

Synchronous JWE encrypt and decrypt over `string` data.

```typescript
import { JweKit } from "@lindorm/aegis";

const kit = new JweKit({
  kryptos,
  logger,
  encryption: "A256GCM", // optional; falls back to kryptos.encryption
});

const encrypted = kit.encrypt("secret data", { objectId: "msg-002" });
// → { token }

const decrypted = kit.decrypt(encrypted.token);
// → { decoded, header, payload, token }

JweKit.isJwe(token);
JweKit.decode(token);
```

Compressed payloads (`zip` header) are explicitly rejected.

## SignatureKit

Low-level signature primitives over raw bytes. Dispatches to the appropriate driver kit based on `kryptos.type` (AKP / EC / OKP / RSA / oct).

```typescript
import { SignatureKit } from "@lindorm/aegis";

const kit = new SignatureKit({ kryptos });

const signature = kit.sign(data); // Buffer
const valid = kit.verify(data, signature); // boolean
kit.assert(data, signature); // throws on mismatch
const formatted = kit.format(signature); // string
```

## Token profiles

`aegis.mint(profile, content)` and `aegis.verify(profile, token, options)` apply a named token profile (`access_token`, `id_token`, `delegation`, …) on top of the standard JOSE operations.

**`typ` presence.** Each profile declares a `typ` policy: `required` (the header must carry exactly the profile's typ) or `none` (no typ mandated). Mint always stamps the profile's typ value — presence only governs verify.

**Required claims on verify.** Profiled verify enforces the profile's `required` claims (the same domain-keyed names enforced at mint) — a token missing one is rejected with `jwt_required_claims_missing`. Missing means absent, `null`, or an empty string.

## COSE / CWT

COSE mirrors JOSE across the board. The `cws` / `cwe` / `cwt` namespaces are the wire-for-wire counterparts of `jws` / `jwe` / `jwt`, and every token profile can be issued as a CBOR Web Token (CWT, RFC 8392) instead of a JWT by passing `format: "cwt"` to `mint` — the same profile, the same domain claims, the same validation floor, only the wire encoding differs. The token is returned as a base64url string.

| JOSE         | COSE         | What                                      |
| ------------ | ------------ | ----------------------------------------- |
| `jws`        | `cws`        | Raw signature over a payload (COSE_Sign1) |
| `jwe`        | `cwe`        | Encryption (COSE_Encrypt0, direct AEAD)   |
| `jwt`        | `cwt`        | Standard-claim token (CWT)                |
| `mint` `jwt` | `mint` `cwt` | Profiled token (`format: "cwt"`)          |
| `sign` `jws` | `sign` `cws` | Opaque handle (`format: "cws"`)           |

```typescript
const { token } = await aegis.mint(
  "access_token",
  { subject: "user-123", audience: ["https://api.example.com"], clientId: "app-1" },
  { format: "cwt" },
);

// Verify never needs to be told the wire format — it detects COSE vs JOSE from
// the token itself, so the same call verifies a CWT or a JWT of the same profile.
const verified = await aegis.verify("access_token", token, {
  audience: "https://api.example.com",
});

// …or without a profile — auto-detected, integrity only:
const smart = await aegis.verify(token);
```

### Token structure

The COSE structure follows the key and the profile:

- **Signed** — an asymmetric key produces a `COSE_Sign1` (the default).
- **MAC'd** — a symmetric `oct` key produces a `COSE_Mac0` (HMAC is a MAC algorithm, never a `COSE_Sign1` signature). The same `algClass` policy applies as for JWTs.
- **Encrypted** — an encryptable profile minted with `encrypt` (or carrying `sensitive_identity`) is sign-then-encrypted into a `COSE_Encrypt0`. Direct AES-GCM and AES-CCM (all eight RFC 9053 variants) are supported.

### `typ` and proprietary encoding

The COSE `typ` header carries the CWT media type — `application/at+cwt`, `application/secevent+cwt`, etc. (the JWT path's `application/at+jwt` family with the `+jwt` suffix swapped for `+cwt`; bare `JWT` → `application/cwt`, the one IANA-registered CWT type).

By default the claims use lindorm-proprietary compact encodings (integer-keyed `act` / `sub_id`, private-use labels for lindorm-only claims). Pass `proprietary: false` to emit a fully interoperable, string-keyed payload that a stock COSE/CWT verifier reads, at the cost of larger tokens:

```typescript
await aegis.mint("access_token", content, { format: "cwt", proprietary: false });
```

Either way the signature itself is plain RFC 9052 — verified in interop tests against `@auth0/cose` and `cose-js`.

### Opaque handles (raw COSE sign — `cws`)

`aegis.cws.sign(payload, options)` (equivalently `aegis.sign({ format: "cws", payload })`) is the profile-less sibling of the raw JWS `sign` — it secures an arbitrary CBOR claims map as a `COSE_Sign1` CWT. Because the token is base64url CBOR with no JOSE dot structure, a consumer cannot split it and read it as a JWT: it is an **opaque handle** (e.g. an internal reference `{ tid, sec }` signed with an unpublished key). The payload MUST be a plain object — a pre-serialised string/Buffer is a JWS-only shape and is rejected (`cose_payload_not_object`); `typ` derives from the bare `tokenType`. `verify` auto-detects it like any COSE token.

```typescript
const { token } = await aegis.cws.sign(
  { tid: "ref-1", sec: "…" },
  { tokenType: "access_token" },
);
const parsed = await aegis.cws.verify(token); // { claims, header, token }
```

### Generic CWT and COSE encryption (`cwt` / `cwe`)

`cwt` is the COSE mirror of the generic `jwt`: `cwt.sign` secures a standard-claim CWT (no profile floor, no auto-injection), and `cwt.verify` validates the standard claims (`exp`/`nbf`/`iss`/`aud`) exactly as `jwt.verify` validates a JWT. `cwe` is the COSE mirror of `jwe` — direct AEAD to a symmetric `use:"enc"` key (`COSE_Encrypt0`), returning the plaintext as raw bytes.

```typescript
const cwt = await aegis.cwt.sign({
  subject: "user-123",
  audience: ["https://api.example.com"],
  expires: "1h",
});
const parsed = await aegis.cwt.verify(cwt.token, {
  audience: "https://api.example.com",
}); // rejects an expired or wrong-audience CWT

const cwe = await aegis.cwe.encrypt("secret"); // string or Buffer
const { payload } = await aegis.cwe.decrypt(cwe.token); // Buffer
```

## Sign content shape

`SignJwtContent` accepts the standard, OIDC, OAuth, PoP, delegation, and Lindorm claim families plus:

```typescript
{
  expires: string | Date;       // required, e.g. "1h", "30m", or a Date
  subject: string;              // required
  tokenType: string;            // required, e.g. "access_token"

  audience?: string[];
  claims?: Record<string, any>; // arbitrary custom claims
  scope?: string[];
  permissions?: string[];
  roles?: string[];
  groups?: string[];
  entitlements?: string[];
  authorizationDetails?: AuthorizationDetail[]; // RFC 9396 (RAR) — see below
  clientId?: string;
  grantType?: string;
  tenantId?: string;
  sessionId?: string;
  nonce?: string;
  notBefore?: Date;
  authTime?: Date;
  authContextClassReference?: string;
  authFactor?: string[];
  authMethods?: string[];
  authorizedParty?: string;
  levelOfAssurance?: number;
  sessionHint?: string;
  subjectHint?: string;
  // …plus the rest of the StdClaims / OidcClaims / DelegationClaims surface
}
```

### Rich Authorization Requests (RFC 9396)

`authorizationDetails` carries the RFC 9396 `authorization_details` claim. The
domain name (`authorizationDetails`) is translated to the registered wire name
(`authorization_details`) on sign and back on parse. The array **contents travel
verbatim** — type-specific inner fields (e.g. `instructedAmount`,
`creditorAccount`) are never key-converted, so camelCase fields defined by a
detail's own spec are preserved exactly.

```typescript
kit.sign({
  expires: "1h",
  subject: "user-123",
  tokenType: "access_token",
  authorizationDetails: [
    {
      type: "payment_initiation",
      actions: ["initiate"],
      locations: ["https://api.bank.example.com/payments"],
      instructedAmount: { currency: "EUR", amount: "123.50" }, // verbatim
    },
  ],
});
```

## Verify options

`VerifyJwtOptions` extends the claim matcher set. Each field accepts either a literal value or a `PredicateOperator` for flexible matching:

```typescript
await aegis.jwt.verify(token, {
  audience: "https://api.example.com",
  scope: ["read", "write"], // array contains
  tokenType: "access_token",
  subject: { $in: ["user-1", "user-2"] },
  levelOfAssurance: { $gte: 2 },
  authTime: { $gte: new Date("2024-01-01") },
});
```

Additional verify options:

- `actor` — controls token-delegation (`act`) chain enforcement
- `dpopProof` — when present, the verifier requires a `cnf.jkt` binding and validates the supplied DPoP proof
- `trustBoundThumbprint` — when `true`, allow a bound token without an inline DPoP proof (for cases where the binding is enforced out-of-band)

## Type guards

```typescript
import { isParsedJwt, isParsedJws } from "@lindorm/aegis";

const parsed = await aegis.verify(token);
if (isParsedJwt(parsed)) {
  /* parsed.payload typed as ParsedJwtPayload */
}
if (isParsedJws(parsed)) {
  /* parsed.payload typed as Buffer | string */
}
```

## Errors

```typescript
import {
  AegisError, // base class
  JwtError,
  JwsError,
  JweError,
} from "@lindorm/aegis";
```

## Security notes

- Signature/decryption keys are always sourced from the supplied `IAmphora`. The `jku`, `jwk`, `x5u`, `x5c`, `x5t`, and `x5t#S256` JOSE header parameters are never trusted as key sources during verification — only `kid` is used as a lookup key into Amphora. The COSE verify path is the same: the signing/encryption key is resolved only by the COSE `kid` (unprotected header, label 4), never from anything embedded in the token.
- JWE payload compression (`zip` header) is rejected outright.
- Critical header parameters are enforced per RFC 7515 §4.1.11; unknown `crit` entries cause verification to fail.
- DPoP-bound tokens (`cnf.jkt`) require either a matching DPoP proof or `trustBoundThumbprint: true` on verify.
- Tokens are never logged whole. Every log line and error payload carries a token as `header.payload` — the signature is dropped, so a logged token stays debuggable but unusable. A JWE is logged as its protected header only; a token with no safely-showable structure (opaque, COSE/CWT) is logged as `[Filtered]`. This applies to DPoP proofs passed on verify as well.

## Testing

The package ships pre-built mock factories for both Jest and Vitest. Import from the runner-specific subpath:

```typescript
// Jest
import { createMockAegis } from "@lindorm/aegis/mocks/jest";

// Vitest
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";

const aegis = createMockAegis(); // fully mocked IAegis
```

## License

AGPL-3.0-or-later
