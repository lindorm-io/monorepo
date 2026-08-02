# @lindorm/aegis

Token operations for JWT, JWS, JWE and their COSE counterparts (CWT / CWS / CWE), backed by an Amphora key store.

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

`Aegis` is an async façade over an `IAmphora` key store — it resolves keys by `kid` and runs the operation. It offers **two surfaces**, and the difference is the return shape:

- **Domain verbs** — `aegis.sign` / `mint` / `encrypt` / `verify` / `decrypt` / `parse`. These speak the aegis domain vocabulary. `verify` returns a unified `VerifiedToken`: domain-keyed claims split into buckets — `.claims` (registered), `.custom` (everything else), plus `.profile` / `.sensitive` — a domain `.header`, and a `.format` discriminant. **No `.payload`.**
- **Wire namespaces** — `aegis.jwt` / `jws` / `jwe` / `cwt` / `cwm` / `cws` / `cwe`. Each resolves the key then delegates to its kit. `sign` / `encrypt` return the same domain `SignedToken` / `EncryptedToken` sugar the verbs do (`.token`, `.format`); `verify` / `decrypt` return the kit's **native wire shape** — a `.payload` with wire claim names (`sub` / `exp` / `jti`, never `subject` / `expiresAt` / `tokenId`), exactly what a standalone JOSE / COSE library reads.

The same token reads either way: `aegis.jwt.verify(t)` hands you the raw wire; `aegis.verify(t)` hands you the domain `VerifiedToken`.

**Kit classes** (`JwtKit`, `JwsKit`, `JweKit`, `SignatureKit`) are the synchronous, single-key wire primitives underneath. You supply an `IKryptos` key directly: `sign` / `encrypt` return the **bare token** (a `string` for JOSE, a `Buffer` for COSE), `verify` / `decrypt` the native wire `.payload` shape — no Amphora, no domain translation. Use these when you already hold the key.

`Aegis` instance methods are async (they perform key lookups); all kit instance methods are synchronous.

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
  sign: { condition: { purpose: "token" } },
  encrypt: { condition: { purpose: "token" } },
});
```

### Key selection

Key selection is one mechanism — a **condition** — doing two strictly separate jobs.

- **Floor** — policy. Aegis's invariant for the operation, plus the artifact's own
  opinion (a profile's `algClass`). Enforced on **every** key that reaches the crypto
  layer: selected from the vault, named by a token's `kid`, or supplied outright.
- **Selector** — a vault query. "Which of _my_ keys." The deployment default merged
  with the per-call condition (shallow; the caller's key wins). It is meaningless for
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

Every selector is amphora's `AmphoraKeySelector` — `{ kryptos?, condition? }`, the one
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
  sign: { key: { condition: { algorithm: client.idTokenSignedResponseAlg } } },
});

// FAPI is deployment policy, not a key property — aegis publishes the list.
import { FAPI_SIG_ALGS } from "@lindorm/aegis";

await aegis.mint("id_token", content, {
  sign: { key: { condition: { algorithm: { $in: FAPI_SIG_ALGS } } } },
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

// The read side. Selection follows the token's own `kid`, so a condition is a
// CHECK on the resolved key, applied before the signature is touched — a token
// must not get to choose the class of key that verifies it (RFC 8725 §3.1).
const aegis = new Aegis({
  amphora,
  logger,
  verify: { condition: { algClass: "asymmetric" } },
});
```

### Namespaced operations (wire surface)

Each namespace resolves the key by `kid`, delegates to its kit, and speaks **only the wire** — input AND output. `sign` takes an already-wire claim dict (JOSE names — `sub`/`exp`/`jti`) and serializes it **verbatim**: no domain translation, no envelope auto-injection (`iat`/`jti`/`nbf`/`iss`), no hash derivation. `verify` takes a positional wire `assert` condition and returns the kit's native wire shape (`.payload` carries wire claim names). Named identity matchers, DPoP, actor chains, auto-injection and domain translation live on the domain verbs (`aegis.mint` / `aegis.verify`), not here.

```typescript
const signed = await aegis.jwt.sign(
  {
    iss: "https://idp.example.com",
    sub: "user-123",
    aud: ["https://api.example.com"],
    exp: 1737000000,
    scope: ["read", "write"],
    role: "admin", // custom claims sit flat on the payload
  },
  { tokenType: "at" }, // the type PREFIX → `application/at+jwt`
);

const parsed = await aegis.jwt.verify(signed.token);
// parsed.payload → { sub: "user-123", exp: 1737000000, aud: [...], scope: [...] }  (WIRE names)
// parsed.header (WireTokenHeader), parsed.token

// matching is a positional WIRE assert condition (no named domain matchers here):
const checked = await aegis.jwt.verify(signed.token, { iss: "https://idp.example.com" });

const jws = await aegis.jws.sign("payload");
const verifiedJws = await aegis.jws.verify<string>(jws.token);
// verifiedJws.payload === "payload" — the cty header round-trips the native type

const jwe = await aegis.jwe.encrypt("secret");
const decrypted = await aegis.jwe.decrypt<string>(jwe.token); // decrypted.payload === "secret"
```

The COSE namespaces `cwt` / `cwm` / `cws` / `cwe` are the wire-for-wire COSE counterparts — same surface, same key resolution, CBOR wire (see [COSE / CWT](#cose--cwt)). The claims-bearing CWT splits by integrity structure: `cwt` is a `COSE_Sign1` (asymmetric key), `cwm` is a `COSE_Mac0` (symmetric key):

```typescript
// cwt — generic CWT, COSE_Sign1 (asymmetric), the COSE mirror of jwt.
// Takes COSE-name-keyed WIRE claims verbatim (`cti`, not `jti`); `exp` a NumericDate.
const cwt = await aegis.cwt.sign(
  {
    iss: "https://idp.example.com",
    sub: "user-123",
    aud: ["https://api.example.com"],
    exp: 1737000000,
  },
  { tokenType: "at" }, // → application/at+cwt
);
const parsedCwt = await aegis.cwt.verify(cwt.token);
// parsedCwt.payload → COSE-name-keyed wire ({ cti, exp, ... }); parsedCwt.header, .token

// cwm — the same, as a COSE_Mac0 (symmetric key)
const cwm = await aegis.cwm.sign({
  iss: "https://idp.example.com",
  sub: "user-123",
  exp: 1737000000,
});
const parsedCwm = await aegis.cwm.verify(cwm.token);

// cws — raw COSE_Sign1, the opaque COSE mirror of jws
const cws = await aegis.cws.sign({ tid: "at_abc" }, { tokenType: "access_token" });
const parsedCws = await aegis.cws.verify(cws.token); // { header, payload: Buffer, token }

// cwe — COSE_Encrypt0, the COSE mirror of jwe (direct AEAD to a symmetric enc key)
const cwe = await aegis.cwe.encrypt("secret");
const decryptedCwe = await aegis.cwe.decrypt(cwe.token); // { payload: Buffer }
```

### Content-type negotiation

The opaque surfaces — `jws` / `cws` / `jwe` / `cwe` — secure arbitrary `TokenContent`, and the `cty` header round-trips the native JS type on read. Sign / encrypt a `Dict` and `verify` / `decrypt` hands back a `Dict` (`application/json`); a `string` round-trips as a `string` (`text/plain`); a `Buffer` as a `Buffer` (`application/octet-stream`). An absent or unknown `cty` falls back to the raw `Buffer` — aegis never guesses a parse the wire did not declare.

A **nested token** is labelled by its own `cty`: a JWT (`cty: "JWT"`) reconstructs as its compact `string`, a CWT (`cty: "application/cwt"`) as its `Buffer`, so a sign-then-encrypt chain re-reads the inner token verbatim.

```typescript
const sealed = await aegis.jwe.encrypt({ hello: "world" });
const opened = await aegis.jwe.decrypt<Dict>(sealed.token);
// opened.payload → { hello: "world" }  (Dict in, Dict out)
```

### AES helpers

```typescript
const encoded = await aegis.aes.encrypt("data"); // base64 string (CBOR, the default)
const cbor = await aegis.aes.encrypt("data", "cbor"); // base64 string (explicit)
const record = await aegis.aes.encrypt("data", "record"); // AesEncryptionRecord
const serialised = await aegis.aes.encrypt("data", "serialised"); // SerialisedAesEncryption

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
const cookie = await aegis.aes.encrypt(session, {
  key: { condition: { purpose: "cookie", publish: false } },
});

// The ciphertext names its own key, so the read side needs no selector — the
// lookup is unfiltered and still finds an expired or unpublished key.
const session = await aegis.aes.decrypt(cookie);

// `encryption` picks the CIPHER, never the key.
await aegis.aes.encrypt(data, { key: { encryption: "A128CBC-HS256" } });
```

A key supplied outright is the one case the vault cannot serve on the way back, so
**decrypt takes a `kryptos` too** — encrypting with a detached key and being unable to
decrypt it again would otherwise be a silent one-way trip. The floor still applies, and a
supplied key that is not the one the ciphertext names throws (`decrypt_key_mismatch`)
rather than being quietly ignored.

```typescript
const encoded = await aegis.aes.encrypt(data, { key: { kryptos: detached } });
const plain = await aegis.aes.decrypt(encoded, { key: { kryptos: detached } });
```

### Universal verification

`aegis.verify(token, assert?, options?)` auto-detects the format — JWT, JWS, JWE, or any COSE token (base64url CBOR, no JOSE dot structure) — and returns the unified domain `VerifiedToken`. A JWE / CWE is decrypted first, then its inner MUST be a signed token (an unsigned encrypted claims set throws `verify_requires_signature` — read those with `aegis.decrypt`). The result is therefore **always** signature-verified.

```typescript
const result = await aegis.verify(anyToken, {
  audience: "https://api.example.com",
});

result.format; // "jwt" | "jws" | "jwe" | "cwt" | "cwm" | "cws" | "cwe"
result.claims.subject; // domain-keyed registered claims
result.custom; // non-registered claims
result.header.tokenType; // domain-keyed header
// jws/cws carry empty claims/custom and deliver the opaque payload on result.raw
```

### Encryption

`aegis.encrypt` / `aegis.decrypt` are the confidentiality mirror of `sign` — pure encryption with **no inner signature** (for sender authentication, `mint(profile, content, { encrypt })` and read it back with `verify`). `encrypt` translates a domain claims set to the wire and seals it in a JWE (or a `COSE_Encrypt0` with `format: "cwe"`); an opaque `Buffer` / `string` passes through untouched. `decrypt` reverses it with **no signature check**, returning a `DecryptedToken`.

```typescript
const enc = await aegis.encrypt({ subject: "user-123", tenantId: "t-1" });
// → { format: "jwe", token }

const dec = await aegis.decrypt(enc.token);
// → { format: "jwe", claims: { subject, tenantId }, custom, header, token }

const cwe = await aegis.encrypt(data, { format: "cwe" }); // COSE_Encrypt0 instead
```

### Keyless parse

`aegis.parse(token)` reads a **structured** token's claims WITHOUT a key or signature check — a JWT, CWT, or CWM → a strict `ParsedToken` (`format` / `header` / `claims` / `custom`, all domain-keyed). It is a claims reader, so it refuses the rest: an opaque JWS / CWS throws `parse_requires_claims` (read those with `aegis.jws.verify` / `aegis.cws.verify`), and an encrypted JWE / CWE throws `parse_requires_decrypt` (read those with `aegis.decrypt`). The result is UNVERIFIED — use `aegis.verify` for authenticity. It is an instance method but synchronous (no key lookup).

```typescript
const parsed = aegis.parse(idToken);
parsed.claims.subject; // domain-keyed, unverified
parsed.header.keyId;
```

### Static helpers

These do not need a key or amphora.

```typescript
Aegis.isJwt(token);
Aegis.isJws(token);
Aegis.isJwe(token);
Aegis.isJose(token); // any JOSE token (JWT, JWS, or JWE)

Aegis.isCose(token); // any COSE token — the other wire family
Aegis.isCwt(token); // COSE_Sign1 CWT (asymmetric)
Aegis.isCwm(token); // COSE_Mac0 CWT (symmetric)
Aegis.isCws(token); // opaque COSE_Sign1
Aegis.isCwe(token); // COSE_Encrypt0

Aegis.toDomain(wire); // wire claim dict → { claims, custom } domain claims
Aegis.toWire(claims); // domain claims → JOSE-keyed wire dict
Aegis.assert(claims, matchers); // throws on mismatch
```

`Aegis.header` and `Aegis.decode` are gone — read a verified token's `.header`, use the keyless instance `aegis.parse` for an unknown structured token (above), or a kit's keyless static `.decode` (e.g. `JwtKit.decode`) for a known format.

## JwtKit

Synchronous, **wire-level** JWT sign and verify against a single `IKryptos` key. The kit is transform-free: it puts the exact claim names it is handed onto the wire and returns the exact names it read off it — no auto `iat` / `jti` / `nbf`, no domain translation, no named matchers. That is the `Aegis` layer's job.

```typescript
import { JwtKit } from "@lindorm/aegis";

const kit = new JwtKit({ kryptos, logger, clockTolerance: 30 });

const token = kit.sign({
  iss: "https://example.com",
  sub: "user-123",
  exp: Math.floor(Date.now() / 1000) + 3600,
  jti: "tok-1",
}); // → the compact JWT string

const parsed = kit.verify(token, { iss: "https://example.com" });
// parsed.payload → wire claims ({ iss, sub, exp, jti }); parsed.header, parsed.token

JwtKit.isJwt(token); // static
JwtKit.decode(token); // static → { header, payload, signature, token } — no verification
```

`verify` runs crit, typ well-formedness, algorithm-match, signature, cert-binding, reserved-claim type checks, and the temporal range (`exp` / `nbf` / `iat`, validated if present) — plus the optional `assert` condition over the wire claims.

## JwsKit

Synchronous JWS sign and verify over arbitrary `TokenContent` (a `Dict`, `string`, `Buffer`, …); the `cty` header round-trips the native type.

```typescript
import { JwsKit } from "@lindorm/aegis";

const kit = new JwsKit({ kryptos, logger });

const token = kit.sign("hello world", { header: { oid: "msg-001" } });
// → the compact JWS string

const parsed = kit.verify<string>(token);
// parsed.payload === "hello world" (the cty header round-trips the native type)

JwsKit.isJws(token); // static
JwsKit.decode(token); // static → { header, payload, signature, token } — no verification
```

## JweKit

Synchronous JWE encrypt and decrypt over arbitrary `TokenContent`; the `cty` header round-trips the native type.

```typescript
import { JweKit } from "@lindorm/aegis";

const kit = new JweKit({
  kryptos,
  logger,
  encryption: "A256GCM", // optional; falls back to kryptos.encryption
});

const token = kit.encrypt("secret data", { header: { oid: "msg-002" } });
// → the compact JWE string

const decrypted = kit.decrypt<string>(token);
// → { header, payload, token }

JweKit.isJwe(token); // static
JweKit.decode(token); // static → { header, token } — header only, no decryption
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

`aegis.mint(profile, content)` and `aegis.verify(profile, token, assert?, options)` apply a named token profile (`access_token`, `id_token`, `delegation`, …) on top of the standard JOSE operations. The floor's `audience` / `issuer` live in the profile `options` (the fourth argument); extra claim matchers go in the optional `assert` (third).

**`typ` presence.** Each profile declares a `typ` policy: `required` (the header must carry exactly the profile's typ) or `none` (no typ mandated). Mint always stamps the profile's typ value — presence only governs verify.

**Required claims on verify.** Profiled verify enforces the profile's `required` claims (the same domain-keyed names enforced at mint) — a token missing one is rejected with `jwt_required_claims_missing`. Missing means absent, `null`, or an empty string.

## COSE / CWT

COSE mirrors JOSE across the board. The `cwt` / `cwm` / `cws` / `cwe` namespaces are the wire-for-wire counterparts of the JOSE family, and every token profile can be issued as a CBOR Web Token (CWT, RFC 8392) instead of a JWT by passing `format: "cwt"` to `mint` — the same profile, the same domain claims, the same validation floor, only the wire encoding differs. The token is returned as a base64url string.

| JOSE         | COSE         | What                                      |
| ------------ | ------------ | ----------------------------------------- |
| `jws`        | `cws`        | Raw signature over a payload (COSE_Sign1) |
| `jwe`        | `cwe`        | Encryption (COSE_Encrypt0, direct AEAD)   |
| `jwt`        | `cwt`        | Standard-claim token, signed (COSE_Sign1) |
| `jwt` (HS\*) | `cwm`        | Standard-claim token, MAC'd (COSE_Mac0)   |
| `mint` `jwt` | `mint` `cwt` | Profiled token (`format: "cwt"`)          |
| `sign` `jws` | `sign` `cws` | Opaque handle (`format: "cws"`)           |

The claims-bearing CWT is split by integrity structure: `cwt` is a `COSE_Sign1` gated to an **asymmetric** key, `cwm` is a `COSE_Mac0` gated to a **symmetric** key. `mint` / `aegis.verify` pick the right one automatically from the resolved key's class; the raw namespaces (`aegis.cwt` / `aegis.cwm`) each reject the wrong key class.

```typescript
const { token } = await aegis.mint(
  "access_token",
  { subject: "user-123", audience: ["https://api.example.com"], clientId: "app-1" },
  { format: "cwt" },
);

// Verify never needs to be told the wire format — it detects COSE vs JOSE from
// the token itself, so the same call verifies a CWT or a JWT of the same profile.
const verified = await aegis.verify("access_token", token, undefined, {
  audience: "https://api.example.com",
});

// …or without a profile — auto-detected, integrity only:
const smart = await aegis.verify(token);
```

### Token structure

The COSE structure follows the key and the profile:

- **Signed** — an asymmetric key produces a `COSE_Sign1` (the `cwt` namespace; the default).
- **MAC'd** — a symmetric `oct` key produces a `COSE_Mac0` (the `cwm` namespace — HMAC is a MAC algorithm, never a `COSE_Sign1` signature). The same `algClass` policy applies as for JWTs.
- **Encrypted** — an encryptable profile minted with `encrypt` (or carrying `sensitive` fields) is sign-then-encrypted into a `COSE_Encrypt0`. Direct AES-GCM and AES-CCM (all eight RFC 9053 variants) are supported.

### `typ` and proprietary encoding

The COSE `typ` header carries the CWT media type — `application/at+cwt`, `application/secevent+cwt`, etc. (the JWT path's `application/at+jwt` family with the `+jwt` suffix swapped for `+cwt`; bare `JWT` → `application/cwt`, the one IANA-registered CWT type).

By default the claims are fully interoperable — a string-keyed payload that a stock COSE/CWT verifier reads, with the strict alg/enc interop gate ON. Pass `proprietary: true` for the lindorm-native compact encodings (integer-keyed `act` / `sub_id`, private-use labels for lindorm-only claims, gate off), at the benefit of smaller tokens:

```typescript
await aegis.mint("access_token", content, { format: "cwt", proprietary: true });
```

Either way the signature itself is plain RFC 9052 — verified in interop tests against `@auth0/cose` and `cose-js`.

### Opaque handles (raw COSE sign — `cws`)

`aegis.cws.sign(payload, options)` (equivalently `aegis.sign({ format: "cws", payload })`) is the profile-less sibling of the raw JWS `sign` — it secures an arbitrary CBOR claims map as a `COSE_Sign1` CWT. Because the token is base64url CBOR with no JOSE dot structure, a consumer cannot split it and read it as a JWT: it is an **opaque handle** (e.g. an internal reference `{ tid, sec }` signed with an unpublished key). The payload MUST be a plain object — a pre-serialised string/Buffer is a JWS-only shape and is rejected (`cose_payload_not_object`); `typ` derives from the bare `tokenType`. `verify` auto-detects it like any COSE token.

```typescript
const { token } = await aegis.cws.sign(
  { tid: "ref-1", sec: "…" },
  { tokenType: "access_token" },
);
const parsed = await aegis.cws.verify(token); // { header, payload: Buffer, token } — opaque
```

### Generic CWT and COSE encryption (`cwt` / `cwm` / `cwe`)

`cwt` is the COSE mirror of the generic `jwt`: `cwt.sign` secures already-wire COSE-name-keyed claims verbatim (no domain translation, no auto-injection), and `cwt.verify` validates them structurally + temporally (`exp` / `nbf`) exactly as `jwt.verify` validates a JWT, returning the COSE-name-keyed wire payload (`cti` / `exp`). `cwm` is the same over a symmetric key (`COSE_Mac0`). `cwe` is the COSE mirror of `jwe` — direct AEAD to a symmetric `use:"enc"` key (`COSE_Encrypt0`), returning the plaintext as raw bytes.

```typescript
const cwt = await aegis.cwt.sign(
  {
    iss: "https://idp.example.com",
    sub: "user-123",
    aud: ["https://api.example.com"],
    exp: 1737000000,
  },
  { tokenType: "at" }, // → application/at+cwt
);
const parsed = await aegis.cwt.verify(cwt.token);
// parsed.payload → COSE-name-keyed wire ({ cti, exp, ... }); rejects an expired CWT

const cwe = await aegis.cwe.encrypt("secret"); // string or Buffer
const { payload } = await aegis.cwe.decrypt(cwe.token); // Buffer
```

## Sign content shape (domain surface)

`SignJwtContent` is the DOMAIN content `aegis.mint` accepts (via each profile's `SignContent`). The raw wire tier — `aegis.sign` and the `aegis.jwt.sign` namespace — takes wire claims instead. It carries the standard, OIDC, OAuth, PoP, delegation, and Lindorm claim families plus:

```typescript
{
  expires: string | Date;       // required, e.g. "1h", "30m", or a Date
  subject: string;              // required
  tokenType: string;            // required, e.g. "Bearer" / "DPoP"

  audience?: Array<string>;
  claims?: Record<string, any>; // arbitrary custom claims
  scope?: Array<string>;
  permissions?: Array<string>;
  roles?: Array<string>;
  groups?: Array<string>;
  entitlements?: Array<string>;
  authorizationDetails?: Array<AuthorizationDetail>; // RFC 9396 (RAR) — see below
  clientId?: string;
  grantType?: string;
  tenantId?: string;
  sessionId?: string;
  nonce?: string;
  notBefore?: Date;
  authTime?: Date;
  authContextClassReference?: string;
  authFactorReference?: string;      // afr — resolved factor: 1fa | 2fa | phr | phrh
  authFactorCategories?: Array<string>; // afc — knowledge | possession | inherence
  authMethods?: Array<string>;
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

The `authorizationDetails` → `authorization_details` name translation is a DOMAIN feature, so it runs on `aegis.mint` (and `aegis.encrypt` for domain claims), not the raw wire `aegis.sign` / `aegis.jwt.sign`:

```typescript
await aegis.mint("access_token", {
  subject: "user-123",
  audience: ["https://api.bank.example.com"],
  clientId: "app-1",
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

## Verify: assert + options

`aegis.verify(token, assert?, options?)` splits the domain verify into two
positional arguments (the wire namespaces resolve the key and check
structure/temporal only — named matchers, DPoP and actor chains are the domain
surface's job):

- **`assert`** (`DomainAssert`) — the declarative claim matcher. Eight named
  matchers earn non-equality semantics (`audience` is contains-self; `scope` /
  `authMethods` / `roles` / `permissions` / `groups` / `entitlements` are
  array-contains; `issuer` is identity). Every other domain claim folds into a
  free condition, each field accepting a literal value or a `ConditionOperator`.
- **`options`** (`VerifyOptions`) — the verify KNOBS (format-agnostic).

```typescript
await aegis.verify(
  token,
  {
    audience: "https://api.example.com", // aud contains-self
    scope: ["read", "write"], // array contains (all)
    subject: { $in: ["user-1", "user-2"] },
    levelOfAssurance: { $gte: 2 },
    authTime: { $gte: new Date("2024-01-01") },
  },
  {
    tokenType: "access_token",
    accessToken: "the-presented-access-token", // at_hash check
  },
);
```

`VerifyOptions` fields:

- `tokenType` — asserts the JOSE `typ` / COSE type
- `accessToken` / `authCode` / `authState` — verify-time `at_hash` / `c_hash` /
  `s_hash` checks (the source value is hashed with the token's algorithm)
- `actor` — controls token-delegation (`act`) chain enforcement
- `dpopProof` — when present, the verifier requires a `cnf.jkt` binding and validates the supplied DPoP proof
- `trustBoundThumbprint` — when `true`, allow a bound token without an inline DPoP proof (for cases where the binding is enforced out-of-band)
- `key` — per-call verification key policy; `typPresence` / `expPresence` — presence policy for the `typ` / `exp` claims
- `currentDate` — override "now" for the temporal range checks (a token expired against the real clock still verifies against a past `currentDate`); `maxTokenAge` — reject a token whose `iat` is older than N seconds (adds an independent `iat` lower bound + presence)
- `verifyExpiration` / `verifyNotBefore` / `verifyIssuedAt` / `verifyAuthTime` — per-claim temporal RANGE toggles, default `true`. Setting one to `false` skips ONLY that claim's range bound. `verifyExpiration: false` verifies an EXPIRED token (OIDC `id_token_hint`, Core §3.1.2.1: the OP must verify the signature but accept an expired id_token). Presence is independent — `expPresence: "required"` still rejects an exp-LESS token. Signature, `iss` / `aud` / `nonce` and the `*_hash` checks stay enforced; `maxTokenAge` still applies even with `verifyIssuedAt: false`

For a **profiled** verify the audience/issuer floor lives in the options object,
so the assert is the (optional) third argument and options the fourth:
`aegis.verify("access_token", token, assert?, { audience })`.

## Type guards

`aegis.verify` returns a single `VerifiedToken` — discriminate on `.format` (and read `.raw` for the opaque `jws` / `cws`), no guard needed:

```typescript
const v = await aegis.verify(token);
if (v.format === "jws" || v.format === "cws") {
  // v.raw holds the opaque payload; v.claims / v.custom are empty
}
```

For a raw string, `isJwtToken` / `isJwsToken` test the wire shape without an `Aegis` instance (they never throw):

```typescript
import { isJwtToken, isJwsToken } from "@lindorm/aegis";

if (isJwtToken(token)) {
  /* a well-formed JWT string */
}
```

## Errors

Every error extends `AegisError`. `JoseError` is the JOSE base (`JwtError` / `JwsError` / `JweError`), `CoseError` the COSE base (`CwtError` / `CwmError` / `CwsError` / `CweError`); `AegisDomainError` covers domain-tier failures (`parse`, `verify`).

```typescript
import {
  AegisError, // base class
  AegisDomainError,
  JoseError,
  JwtError,
  JwsError,
  JweError,
  CoseError,
  CwtError,
  CwmError,
  CwsError,
  CweError,
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
