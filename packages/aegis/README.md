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

- **Domain verbs** — `aegis.sign` / `mint` / `encrypt` / `verify` / `decrypt` / `parse`. These speak the aegis domain vocabulary. `verify` returns a unified `VerifiedToken`: domain-keyed claims split into buckets — `.claims` (registered), `.custom` (everything else), plus `.profile` / `.sensitive` — ONE domain `.header`, and a `.format` discriminant. **No `.payload`.** The single header is uniform across both wires: `protected`/`unprotected` is a COSE structural fact, and a compact JOSE token has one header and no such bucket. Provenance is kept by CONSTRUCTION instead — aegis decides which bucket a parameter may travel in (the header registry's `placement`), so the only values that can reach `.header` unauthenticated are the COSE `kid` routing hint and the `iv`. Everything a verifier routes, audits or polices a token by is protected-only: refused from the unprotected bag on write, ignored there on read.
- **The DOMAIN write options speak domain names too.** `aegis.sign` / `mint` / `encrypt` take their header bag in aegis vocabulary — `header: { objectId, contentType, critical, jwk, jwksUri, certificateUrl, zip }` — and translate it to whichever wire the call emits, so the same option produces a JOSE `oid` and the matching COSE label without the caller choosing between them. Only the **wire namespaces** below take wire-named header bags (`{ oid, cty, jku, … }`), because a kit is pure wire. Parameters the kit derives from the key or the crypto operation (`algorithm`, `keyId`, `encryption`, the certificate fields, `headerType`, the ECDH-ES party info, the IV/tag/PBKDF pair) cannot be supplied on either tier — the types omit them, and an untyped caller that names one is **refused** on both wires (`jose_reserved_header` / `cose_reserved_header`), never quietly overruled — _unless the value it names one with is EMPTY_, because a parameter that emits nothing is not a parameter. A header bag is normalised before any guard reads it: `undefined`, and the empty value of a parameter the registry says carries nothing when empty, are dropped rather than refused (`{ alg: "" }`, `{ x5c: [] }`, `{ x5t: "" }`). Nothing reaches the wire either way; what a caller does not hear is a refusal for a request that was never going to travel. The one exception is `x5t#S256`, whose empty value is KEPT — it is the parameter aegis binds on, so an empty one must fail in the verifier rather than vanish into no binding — and it is refused from the reserved row exactly as a non-empty one is. The refusal is per KIT, not per parameter class: a JWT that stated an `enc` would advertise a content encryption that never happened, and a CWT that stated an `x5c` would carry the only certificate chain on the token — one no key backs. `jwksUri` is the one the kit only **defaults**: the signing key's own `jwksUri` is stamped when the caller states none, and a caller value overrides it.

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
  issuer: "https://example.com", // optional; falls back to amphora.internal?.issuer
  clockTolerance: 30, // optional, in seconds (default 0)
  defaultEncryption: "A256GCM", // optional; only for keys that declare none
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
- **Scope** — the issuer a `kid` belongs to. Read-side only; see below.

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

A profile's `algClass` is on the `sign` floor alone because the read side selects by
the token's `kid` rather than by a query — there is no question to constrain. It is
still enforced on verify, as a check in the [profiled verify floor](#token-profiles)
against the algorithm the signature was verified under.

There is **no ranking and no fallback**. A key satisfies the policy or it does not,
and a miss throws — falling back to a key the policy forbids is how an unverifiable
token gets minted.

#### Verification keys are scoped to an issuer

A `kid` is unique only **per issuer**, so resolving one across the whole vault lets any
registered issuer's key answer for a token claiming to come from another. Every read
path that has an issuer to work with therefore **narrows** the lookup to it:

| source, in order of precedence | where it comes from                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| the verifier's expected issuer | `options.issuer` on a profiled verify, else the deployment issuer for a `platform`-issuer profile |
| the artifact's own `iss`       | read off the unverified decode (JWT, CWT, CWM)                                                    |
| _nothing_ — unscoped           | the artifact carries no `iss`                                                                     |

The scope only ever **narrows**: it restricts which vault keys may answer, relaxes no
floor, and applies no time or publish filter — a token signed by a since-expired key
still verifies. That is what makes it safe to take from an unverified `iss`: a lie can
only produce a miss. And there is **no fallback** — a `kid` the named issuer does not
hold is a hard failure, never an unscoped retry. Falling back would be worse than not
scoping at all, since an attacker would then need no id collision.

A scope is used only when it is a **URI** (a URL with an authority, or a URN), because
that is the only thing amphora files keys under. A bare identifier names a party, not a
key-registration scope — an RFC 7523 client assertion's `iss` is the `client_id`, and
the `delegation` profile declares `issuer: "per-token"` for exactly that reason — so
scoping by one would not narrow the candidate set, it would empty it. Register client
keys under a URI issuer (a URN is enough) to get scoping, or supply the key outright
via the per-call `key.kryptos`, which bypasses the vault entirely.

**Four read paths stay unscoped, by construction.** A **JWS** and its COSE twin **CWS**
are opaque — arbitrary payload bytes, no claims layer, no `iss` to read. A **JWE** and
its COSE twin **CWE** are encrypted — the claims sit behind the very key being resolved.
A JWE/CWE wrapping a signed inner token is still covered: the inner JWT/CWT re-verifies
through the scoped path.

⚠ The `issuer` on `AegisSettings` and amphora's `internal.issuer` must now agree
**exactly** — a trailing-slash or hostname difference that used to be invisible becomes
a failure to resolve your own signing key. Aegis logs a `warn` at construction when the
two are both set and differ. Declaring the issuer on amphora alone (aegis inherits it)
removes the possibility.

Every selector is amphora's `AmphoraKeySelector` — `{ kryptos?, condition? }`, the one
key-selection vocabulary across the toolkit — narrowed to the attributes aegis permits.
`sign`, `encrypt` and `decrypt` all take the full selector and nothing else — a selector
names the KEY, and the key names its own cipher. **`verify` deliberately carries no
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
// parsed.protectedHeader / parsed.unprotectedHeader (WireTokenHeader), parsed.token

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
// parsedCwt.payload → COSE-name-keyed wire ({ cti, exp, ... });
// parsedCwt.protectedHeader / .unprotectedHeader, .token

// cwm — the same, as a COSE_Mac0 (symmetric key)
const cwm = await aegis.cwm.sign({
  iss: "https://idp.example.com",
  sub: "user-123",
  exp: 1737000000,
});
const parsedCwm = await aegis.cwm.verify(cwm.token);

// cws — raw COSE_Sign1, the opaque COSE mirror of jws
const cws = await aegis.cws.sign({ tid: "at_abc" }, { tokenType: "access_token" });
const parsedCws = await aegis.cws.verify(cws.token);
// { protectedHeader, unprotectedHeader, payload: Buffer, token }

// cwe — COSE_Encrypt0, the COSE mirror of jwe (direct AEAD to a symmetric enc key)
const cwe = await aegis.cwe.encrypt("secret");
const decryptedCwe = await aegis.cwe.decrypt(cwe.token); // { payload: Buffer }
```

### Content-type negotiation

The opaque surfaces — `jws` / `cws` / `jwe` / `cwe` — secure arbitrary `TokenContent`, and the `cty` header round-trips the native JS type on read. Sign / encrypt a `Dict` and `verify` / `decrypt` hands back a `Dict`; a `string` round-trips as a `string` (`text/plain`); a `Buffer` as a `Buffer` (`application/octet-stream`). An absent or unknown `cty` falls back to the raw `Buffer` — aegis never guesses a parse the wire did not declare.

A structured value is labelled `application/json` (RFC 8259) on **every** opaque surface, JOSE and COSE alike — same input, same declaration, `Dict` in and `Dict` out wherever it is sealed.

⚠ `aegis.encrypt` / `aegis.decrypt` are a **pure confidentiality pair** — the value you seal is the value you get back. There is no domain↔wire translation of the payload in either direction: `aegis.encrypt({ subject: "x" })` writes the key `subject`, not `sub` and not CWT claim key 2, and `aegis.decrypt` returns that object under those keys. The result carries ONE `payload` and no claim buckets: a claim is a statement by an issuer, and only a signature establishes one — read claims with `verify` or `parse`.

The CLAIMS surfaces — `jwt` / `cwt` / `cwm`, and `mint` — stamp **no** `cty` at all. A claims token's payload is a claim set by definition, so RFC 7519 §5.2 marks the parameter NOT RECOMMENDED unless the token is nested, and RFC 8392 §7.2 reads a CWT payload as a CBOR map with no `cty` involved. Supply `header: { contentType }` (domain) / `header: { cty }` (wire) to declare a nested token; a caller value always wins.

A **nested token** is labelled by its own `cty`, and `aegis.encrypt` recognises one it is handed — so `aegis.encrypt(signed.token)` and `mint(profile, content, { encrypt })` emit the same declaration:

| sealed token | `cty`              | authority                                                             |
| ------------ | ------------------ | --------------------------------------------------------------------- |
| JWT          | `JWT`              | RFC 7519 §5.2 — a MUST for a nested JWT                               |
| JWS, JWE     | `application/jose` | RFC 7515 §9.2.1 (§4.1.10 also permits the bare `jose`; both are read) |
| CWT, CWM     | `application/cwt`  | RFC 8392 §9.2 — a MACed CWT is a CWT                                  |

Reconstruction follows the label: a JOSE token comes back as its compact `string`, a COSE token as its `Buffer`, so a sign-then-encrypt chain re-reads the inner token verbatim and `aegis.verify` opens the outer and checks the inner signature in one call.

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
```

#### The key picks the cipher

A `Kryptos` that declares an `encryption` states what it is, and every aegis path — JWE,
COSE and AES alike — seals with that algorithm. `AegisSettings.defaultEncryption` is the
deployment fallback for a recipient key that declares none (an imported peer JWK carries
no `enc`), so it can never disagree with a key that did. The resolution is
`kryptos.encryption ?? defaultEncryption ?? "A256GCM"`.

To seal under a different cipher, name a key that declares it:

```typescript
await aegis.aes.encrypt(data, { key: { condition: { purpose: "cookie" } } });
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

`aegis.verify(token, assert?, options?)` auto-detects the format — JWT, JWS, JWE, or any COSE token (base64url CBOR, no JOSE dot structure) — and returns the unified domain `VerifiedToken`. A JWE / CWE is decrypted first, then its inner MUST be a signed token (an unsigned encrypted claims set throws `verify_requires_signature` — read those with `aegis.decrypt`), and a wrapper whose `cty` declares a nested claims token MUST actually hold one (`verify_inner_type_mismatch`; the COSE half refuses the same lie as `cwt_invalid_typ`). The result is therefore **always** signature-verified.

```typescript
const result = await aegis.verify(anyToken, {
  audience: "https://api.example.com",
});

result.format; // "jwt" | "jws" | "jwe" | "cwt" | "cwm" | "cws" | "cwe"
result.claims.subject; // domain-keyed registered claims
result.custom; // non-registered claims
result.header.tokenType; // domain-keyed; the two wire buckets merged, protected last
// jws/cws carry empty claims/custom and deliver the opaque payload on result.raw
```

### Encryption

`aegis.encrypt` / `aegis.decrypt` are the confidentiality mirror of `sign` — pure encryption with **no inner signature** (for sender authentication, `mint(profile, content, { encrypt })` and read it back with `verify`). `encrypt` seals the value it is handed in a JWE (or a `COSE_Encrypt0` with `format: "cwe"`); `decrypt` reverses it with **no signature check** and returns a `DecryptedToken` carrying that same value as its `payload`.

**The payload is opaque, whatever it is made of.** No name translation, no claim normalisation, no empty-value prune: a `Dict` sealed here is a value, not a claim set, so keys spelled like registered claims — and members whose value is `""` or `[]` — are written and returned exactly as given. The HEADER is domain-translated and normalised as on every other verb, because it is aegis's own statement about the token rather than the caller's secret.

```typescript
const enc = await aegis.encrypt({ subject: "user-123", tenantId: "t-1" });
// → { format: "jwe", token }

const dec = await aegis.decrypt(enc.token);
// → { format: "jwe", header, payload: { subject: "user-123", tenantId: "t-1" }, token }

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
Aegis.isJwt(token); // a JWS whose payload is a claims set (RFC 7519 §3)
Aegis.isJws(token); // JWS compact serialization — TRUE for a JWT too
Aegis.isJwe(token); // JWE compact serialization
Aegis.isJose(token); // any JOSE token (JWT, JWS, or JWE)

Aegis.isCose(token); // any COSE token — the other wire family
Aegis.isCwt(token); // COSE_Sign1 CWT (asymmetric)
Aegis.isCwm(token); // COSE_Mac0 CWT (symmetric)
Aegis.isCws(token); // opaque COSE_Sign1
Aegis.isCwe(token); // COSE_Encrypt0

Aegis.toDomain(wire); // wire claim dict → { claims, custom, profile, sensitive }
Aegis.toWire(claims); // domain claims → JOSE-keyed wire dict
Aegis.matches(claims, assert, options?); // boolean — same question, no throw
Aegis.assert(claims, assert, options?); // the throwing layer over `matches`

Aegis.verifyDpopProof({ proof, accessToken, expectedThumbprint, dpopMaxSkew? });
```

`toDomain` resolves the **same four buckets a verified token carries** — registered `claims`, unregistered `custom`, the OIDC standard-claims `profile` bag, and `sensitive` — so a consumer reading an introspection or userinfo response never re-derives the split from its own copy of the claim categories. It previously stopped at `{ claims, custom }`, leaving profile and sensitive claims flat inside `claims`, which is exactly the gap consumers were papering over with hand-kept mirror lists.

⚠ It does **not** apply the confidentiality gate. That gate is a rule about _tokens_ — sensitive claims may surface only from an encrypted one — and `toDomain`'s input is a claim dict of unknown provenance, typically an issuer response over TLS where the release decision was already made according to granted scope. Applying a token rule there would silently drop data the issuer deliberately released. The gate stays in the token read path, the only layer that knows whether a token was encrypted: `aegis.verify` still returns `sensitive: undefined` for an unencrypted token on both wires.

The JOSE guards decide on the **wire grammar** — segment count plus the header parameters the RFCs make REQUIRED (`alg`; `enc` for a JWE) — and on aegis's algorithm allowlist. `typ` is a hint, never the discriminant: RFC 7515 §4.1.9 and RFC 7519 §5.1 both make it optional, so a typ-less id_token, an RFC 9068 `at+jwt`, and an RFC 9449 `dpop+jwt` all read as a JWT. What separates a JWT from an opaque JWS is the payload being a JSON claims object — a signed handle stays a `jws`, including one that DECLARES `typ: JWT` over a non-claims payload. Because every JWT is a JWS (RFC 7519 §3), `isJws` is TRUE for a claims token as well; ask `isJwt` first when you need the narrow answer.

⚠ These are **wire-family** guards — they say which kit `verify` would select, not whether the token carries claims. A `jws` / `cws` passes `isJose` / `isCose` and verifies to an EMPTY claims set. To route a credential between local verification and introspection, use [`isClaimsBearingToken`](#isclaimsbearingtoken--verify-locally-or-introspect).

**`assert` is verify's claim checking, without the signature.** It takes the same `DomainAssert` matcher argument as [`aegis.verify`](#verify-assert--options), applied to any flat, domain-keyed claim dict — a set of claims that arrived some other way (an introspection response, a cached credential). `matches` returns the answer, `assert` is the throwing layer over it and names every failing key (`claims_invalid`). One vocabulary, so a **scalar** against an array-valued claim (`audience`, `scope`, `authMethods`, `roles`, `permissions`, `groups`, `entitlements`) means CONTAINS, not equals:

```typescript
Aegis.matches(
  { audience: ["https://api.example.com"] },
  { audience: "https://api.example.com" },
); // true
Aegis.matches({ scope: ["openid", "profile"] }, { scope: "openid" }); // true
Aegis.matches({ scope: ["openid"] }, { scope: ["openid", "profile"] }); // false — an array requires ALL
```

The three hash-DERIVE matchers (`accessToken` / `authCode` / `authState`) are **not** part of this vocabulary — they are `verify`-only (`VerifyAssert`). Deriving a digest needs the token's signing algorithm, `alg` is a HEADER parameter rather than a claim, and this surface is handed a flat claim dict with no header to read one from. Nothing is lost: `accessTokenHash` / `codeHash` / `stateHash` are ordinary domain claims, so a digest you already hold matches by name.

```typescript
Aegis.matches(verified.claims, { accessTokenHash: knownHash }); // plain equality
await aegis.verify(token, { accessToken: presented }); // verify derives; it holds the key
```

The third argument (`AssertOptions`) is the rest of what verify's options mean for claims alone — the temporal family, and nothing else:

```typescript
Aegis.assert(
  claims,
  { audience: "https://api.example.com" },
  {
    clockTolerance: 30,
    currentDate,
    maxTokenAge: 300,
    verifyExpiration: true, // and verifyNotBefore / verifyIssuedAt / verifyAuthTime
  },
);
```

The temporal range is checked **by default**, with the same builder and the same `0`-second default `aegis.verify` uses — `expiresAt` / `notBefore` / `issuedAt` / `authTime` are bounded if present, tolerated if absent. That is what makes the two substitutable: a claim set inside verify's skew window cannot pass one surface and fail the other, so nothing downstream needs a hand-rolled `exp > now` that quietly carries no tolerance.

`verifyDpopProof` runs the RFC 9449 proof checks standalone — signature over the proof's embedded `jwk`, `typ: dpop+jwt`, the RFC 7638 thumbprint against the token's bound `cnf.jkt`, the §7 `ath` hash of the presented access token, and `iat` freshness (default skew 60s). It needs no key resolution because the proof carries its own key, and it returns the `ParsedDpopProof`.

Reach for it when the access token is **not** locally verifiable: RFC 9449 §6.2 delivers `cnf.jkt` through the introspection response for an opaque token, and the resource server validates the binding itself. `htm` / `htu` are parsed but never compared — aegis does not see the HTTP request, so that comparison belongs to the consumer.

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
// parsed.payload → wire claims ({ iss, sub, exp, jti }); parsed.protectedHeader, parsed.token

JwtKit.isJwt(token); // static
JwtKit.decode(token);
// static → { protectedHeader, unprotectedHeader, payload, signature, token } — no verification
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
JwsKit.decode(token);
// static → { protectedHeader, unprotectedHeader, payload, signature, token } — no verification
```

## JweKit

Synchronous JWE encrypt and decrypt over arbitrary `TokenContent`; the `cty` header round-trips the native type.

```typescript
import { JweKit } from "@lindorm/aegis";

const kit = new JweKit({
  kryptos,
  logger,
  defaultEncryption: "A256GCM", // optional; only when kryptos declares none
});

const token = kit.encrypt("secret data", { header: { oid: "msg-002" } });
// → the compact JWE string

const decrypted = kit.decrypt<string>(token);
// → { protectedHeader, unprotectedHeader, payload, token }

JweKit.isJwe(token); // static
JweKit.decode(token);
// static → { protectedHeader, unprotectedHeader, token } — headers only, no decryption
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

**Typed content.** `mint` resolves the content type from the profile NAME, so a built-in profile is held to its own content type (`AccessTokenContent`, `IdTokenContent`, …) at every call site — inline literal included, no annotation or type argument needed. A claim the profile does not carry is a compile error against that type:

```ts
await aegis.mint("access_token", {
  subject: "user-1",
  audience: [resource],
  clientId: "client-1",
  federationAssuranceLevel: 1,
  // ^ Object literal may only specify known properties, and
  //   'federationAssuranceLevel' does not exist in type 'AccessTokenContent'.
});
```

A name that is not a built-in — a profile registered at runtime with `registerProfile` — falls back to the open `SignContent` vocabulary, so custom profiles keep working unconstrained. `registerProfile` writes into THAT `Aegis` instance's own profile table: a registration (including one that shadows a built-in) never reaches another `Aegis` in the process.

**Policy is one declarative rule list.** A profile carries a single `policy` array; every rule names the direction(s) it runs in, and ONE enforcer applies the rules that name the direction being enforced. There is no per-call-site subset.

```ts
policy: [
  { rule: "required", on: ["mint", "verify"], claims: ["issuer", "subject"] },
  { rule: "forbidden", on: ["mint", "verify"], claims: ["nonce"] },
  { rule: "atLeastOneOf", on: ["mint", "verify"], claims: ["subject", "sessionId"] },
  { rule: "match", on: ["mint", "verify"], condition: { issuer: { $regex: /^https:/ } } },
  { rule: "shape", on: ["mint", "verify"], shape: "crossField" },
  {
    rule: "requiredWhen",
    on: ["mint"],
    needs: ["accessTokenIssued"],
    claim: "accessTokenHash",
    when: (claims, context) => context.accessTokenIssued === true,
  },
];
```

`required` / `forbidden` / `atLeastOneOf` are presence rules; `match` is a flat `Condition` over the domain-keyed claims (the same predicate vocabulary as `assert`); `shape` names a structural validator (`actChain`, `authorizationDetails`, `confirmation`, `crossField`, `events`, `subjectId`). Absent, `null` and `""` all count as NOT PRESENT, in both directions.

Any failure raises `profile_policy_invalid` with `data.direction`, `data.format` and `data.invalid` — a list of every `{ key, message }` the token failed, not just the first category. (Distinct from `claims_invalid`, which means the CALLER's `assert` matchers failed.)

**Rules that read mint-time facts.** `requiredWhen` is the only rule that reads the `SignContext` — facts the claims do not carry, which only the issuer has. It is pinned to `on: ["mint"]` by its own type, and it must declare the context keys it reads in `needs`. Minting refuses with `missing_sign_context` when any of them was not supplied, so an omitted or misspelled key cannot read as `false`:

```ts
// `id_token` requires `at_hash` whenever an access token co-issues, so every
// id_token mint states the fact — including when it is false.
await aegis.mint("id_token", content, { context: { accessTokenIssued: false } });
```

`SignContext` is a closed record, so a key that does not exist is a compile error at the call site as well.

**Direction (`use`).** Separately from the per-rule `on`, a profile declares which DOOR it may be handed to — `"mint"`, `"verify"`, or `"both"`.

`use` is optional when you write a profile and resolves to `"both"`, so every built-in and every `registerProfile` call behaves exactly as before; only a deliberate narrowing changes anything. `mint` refuses a `"verify"` profile with `profile_not_mintable`, profiled `verify` refuses a `"mint"` one with `profile_not_verifiable` — and the narrowing is enforced by the compiler too: a verify-only name resolves to `never` as `mint`'s content type, so the call site does not typecheck either.

**`typ` presence.** Each profile declares a `typ` policy: `required` (the header must carry exactly the profile's typ) or `none` (no typ mandated). Mint always stamps the profile's typ value — presence only governs verify.

**The whole policy runs on verify.** Every rule naming the verify direction is enforced by profiled verify, through the same enforcer mint uses — a mint-time policy alone buys nothing for a profile that verifies tokens minted elsewhere. Beyond the rule list, the floor also asserts what the claims alone cannot state: the algorithm class, the header `typ`, the expected issuer, the verifier's own `audience`, and `exp` presence for a profile with a lifetime.

**`algClass` on verify.** A profile's `algClass` is enforced on BOTH sides for the same reason. At mint it constrains key SELECTION (an asymmetric-only profile never picks an `oct` key); at verify it is checked against the algorithm the signature was verified under, and a mismatch is rejected with `algorithm_not_permitted` before any claim is looked at. `access_token`, `external_access_token` and `delegation` declare `asymmetric` because a shared MAC secret both verifies AND forges — a statement about reading someone else's token, so the verify half is the half that matters. That algorithm is not a header parameter taken on trust: every verify path refuses a header `alg` differing from the resolved key's own before it accepts the signature. A profile declaring no `algClass` is unconstrained, which is why `security_event` (RFC 8417 / SSF, whose own example header is `alg: HS256`) still verifies an HS-signed token.

### `external_access_token` — third-party access tokens

`access_token` is RFC 9068 strict and stays that way. Because its `required` list is enforced at MINT as well as verify, loosening it to admit another issuer's token would also let us ISSUE a degraded one — so a resource server accepting third-party tokens selects `external_access_token` instead.

|             | `access_token`               | `external_access_token`              |
| ----------- | ---------------------------- | ------------------------------------ |
| `typ`       | exactly `application/at+jwt` | none mandated                        |
| `client_id` | required                     | not required                         |
| `aud`       | exactly one resource         | any number                           |
| `iss`       | the deployment's own         | per-token — the verifier declares it |
| signature   | asymmetric                   | asymmetric                           |
| `exp`       | required                     | required                             |

Everything else is unchanged: `iss` / `sub` / `aud` / `iat` / `jti` / `exp` are still required, `aud` must still contain the verifier's own `audience`, and the profile still forbids `nonce` / `at_hash` / `c_hash` / `s_hash`.

⚠ **That `forbidden` list is the id_token defence.** With no `typ` mandated there is no structural discriminator left, and `typ: JWT` is exactly what an id_token carries — so the id_token-only claims are what keeps one out. The second defence is the verifier's required `audience`: an id_token's `aud` is the CLIENT, not the resource server.

⚠ A `typ` the WIRE layer refuses never reaches the profile: `JwtKit.verify` rejects a present `typ` that is neither `JWT` nor `<type>+jwt` (`jwt_invalid_typ`), so an issuer stamping something else — Keycloak's `typ: Bearer` — is refused before any profile floor runs.

The profile declares `use: "verify"`, so `mint("external_access_token", …)` is refused outright — at the call site, where the content type resolves to `never`, and at runtime with `profile_not_mintable`. `autoInject` stays empty because nothing here is ours to generate; it was never the guard, since a caller hand-supplying `iss` / `iat` / `jti` still got a degraded access token signed by our own vault.

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
- **Encrypted** — an encryptable profile minted with `encrypt` (or carrying `sensitive` fields) is sign-then-encrypted into a `COSE_Encrypt0`. Direct AES-GCM and AES-CCM (all eight RFC 9053 variants) are supported. ⚠ A `COSE_Encrypt0` is **direct encryption** (RFC 9052 §5.2): the recipient key IS the content-encryption key, so only a `dir` key can seal one. The nineteen other JWE key-management algorithms have no `COSE_Encrypt0` form, and the kit refuses such a key by name rather than letting it fail deeper down.

### `typ` and proprietary encoding

The COSE `typ` header carries the CWT media type — `application/at+cwt`, `application/secevent+cwt`, etc. (the JWT path's `application/at+jwt` family with the `+jwt` suffix swapped for `+cwt`; bare `JWT` → `application/cwt`, the one IANA-registered CWT type).

By default the whole token is fully interoperable — a string-keyed payload that a stock COSE/CWT verifier reads, the same for any header parameter with no IANA COSE label (`objectId` → the text label `oid`, legal COSE per RFC 9052 §1.5's `label = int / tstr`), and the strict alg/enc interop gate ON. Pass `proprietary: true` for the lindorm-native compact encodings (integer-keyed `act` / `sub_id`, private-use integer labels for lindorm-only claims and header parameters, gate off), at the benefit of smaller tokens:

```typescript
await aegis.mint("access_token", content, { format: "cwt", proprietary: true });
```

Either way the signature itself is plain RFC 9052 — verified in interop tests against `@auth0/cose` and `cose-js`.

### Opaque handles (raw COSE sign — `cws`)

`aegis.cws.sign(payload, options)` (equivalently `aegis.sign({ format: "cws", payload })`) is the profile-less sibling of the raw JWS `sign` — it secures an arbitrary CBOR claims map as a `COSE_Sign1` CWT. Because the token is base64url CBOR with no JOSE dot structure, a consumer cannot split it and read it as a JWT: it is an **opaque handle** (e.g. an internal reference `{ tid, sec }` signed with an unpublished key). The payload is a CBOR claims map; `typ` derives from the bare `tokenType`. `verify` auto-detects it like any COSE token.

```typescript
const { token } = await aegis.cws.sign(
  { tid: "ref-1", sec: "…" },
  { tokenType: "access_token" },
);
const parsed = await aegis.cws.verify(token);
// { protectedHeader, unprotectedHeader, payload: Buffer, token } — opaque
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
  username?: string;            // RFC 7662 §2.2 — NOT preferred_username, see below
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

### `username` is not `preferred_username`

Two similar-looking names, two different specs, two separate registry entries — and
they never shadow each other:

| Claim                | Spec           | Domain name         | Bucket                     |
| -------------------- | -------------- | ------------------- | -------------------------- |
| `username`           | RFC 7662 §2.2  | `username`          | `claims` (`OAuthClaims`)   |
| `preferred_username` | OIDC Core §5.1 | `preferredUsername` | `profile` (`AegisProfile`) |

`username` is a claim **about the token** — if an authorization server can report one
in an introspection answer, a token can carry one — so it travels with the
authorization claims and is read back on both provenances. `preferredUsername` is an
identity field of the subject's profile, and the profile bucket is deliberately kept
out of introspection answers and authorization decisions. A token may carry both; each
round-trips independently.

The split reaches the profile content types. `AccessTokenContent` picks `username`, so
`aegis.mint("access_token", { …, username })` is typed — introspection describes an
access token, so a token may assert about itself what an introspection answer may
report about it. `IdTokenContent` does not pick it; an id token carries
`preferredUsername` through its `profile` container instead.

### Rich Authorization Requests (RFC 9396)

`authorizationDetails` carries the RFC 9396 `authorization_details` claim. The
domain name (`authorizationDetails`) is translated to the registered wire name
(`authorization_details`) on sign and back on parse. The array **contents travel
verbatim** — type-specific inner fields (e.g. `instructedAmount`,
`creditorAccount`) are never key-converted, so camelCase fields defined by a
detail's own spec are preserved exactly.

The `authorizationDetails` → `authorization_details` name translation is a CLAIMS feature, so it runs on `aegis.mint` and nowhere else: not on the raw wire `aegis.sign` / `aegis.jwt.sign`, and not on `aegis.encrypt`, whose payload is opaque:

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

The split is one rule: **a MATCHER asserts what must be true, an OPTION changes
how the check runs.**

- **`assert`** (`VerifyAssert`) — everything asserted. Eight named claim
  matchers earn non-equality semantics (`audience` is contains-self; `scope` /
  `authMethods` / `roles` / `permissions` / `groups` / `entitlements` are
  array-contains; `issuer` is identity). For all seven a bare string means the
  claim must CONTAIN it, an array means it must contain ALL of them, and a
  `ConditionOperator` (`{ $in }`) matches any — `issuer` takes an operator too,
  which is how an OPTIONAL bound is expressed
  (`{ $or: [{ $exists: false }, { $eq: iss }] }`). Four further matchers assert
  something about the TOKEN rather than a claim value: `tokenType` and the three
  hash-derive inputs (below). Every other domain claim folds into a free
  condition, each field accepting a literal value or a `ConditionOperator`.
  `DomainAssert` — the same vocabulary less the hash-derive inputs — drives the
  standalone [`Aegis.matches` / `Aegis.assert`](#static-helpers).
- **`options`** (`VerifyOptions`) — the verify KNOBS. ⚠ Not yet uniform across the
  two wires: see [wire parity](#wire-parity-of-verifyoptions) below.

```typescript
await aegis.verify(
  token,
  {
    audience: "https://api.example.com", // aud contains-self
    scope: ["read", "write"], // array contains (all)
    subject: { $in: ["user-1", "user-2"] },
    levelOfAssurance: { $gte: 2 },
    authTime: { $gte: new Date("2024-01-01") },
    tokenType: "access_token", // the JOSE typ / COSE type
    accessToken: "the-presented-access-token", // at_hash check
  },
  { maxTokenAge: 300 },
);
```

`VerifyAssert`'s four token matchers:

- `tokenType` (`DomainAssert`, so both surfaces) — asserts the JOSE `typ`
  (`application/at+jwt`) or the COSE type (`application/at+cwt`); on a flat
  claim dict (`Aegis.assert`) it is the `tokenType` field
- `accessToken` / `authCode` / `authState` (`DomainHashMatchers`, **verify
  only**) — `at_hash` / `c_hash` / `s_hash` checks. The RAW source value is
  hashed with the token's signing algorithm, not compared literally, and verify
  is the only surface that resolves that algorithm (from the verifying key).
  `Aegis.assert` matches an already-computed digest under its own claim name
  instead

`VerifyOptions` fields:

- `actor` — controls token-delegation (`act`) chain enforcement
- `dpopProof` — when present, the verifier requires a `cnf.jkt` binding and validates the supplied DPoP proof
- `trustBoundThumbprint` — when `true`, allow a bound token without an inline DPoP proof (for cases where the binding is enforced out-of-band)
- `key` — per-call verification key policy; `typPresence` / `expPresence` — presence policy for the `typ` / `exp` claims
- `clockTolerance` — widen every temporal range check by N seconds in both directions, overriding the deployment-wide `clockTolerance` for this call. Applies to profiled and profile-less verify, JOSE and COSE alike
- `currentDate` — override "now" for the temporal range checks (a token expired against the real clock still verifies against a past `currentDate`); `maxTokenAge` — reject a token whose `iat` is older than N seconds (adds an independent `iat` lower bound + presence)
- `verifyExpiration` / `verifyNotBefore` / `verifyIssuedAt` / `verifyAuthTime` — per-claim temporal RANGE toggles, default `true`. Setting one to `false` skips ONLY that claim's range bound. `verifyExpiration: false` verifies an EXPIRED token (OIDC `id_token_hint`, Core §3.1.2.1: the OP must verify the signature but accept an expired id_token). Presence is independent — `expPresence: "required"` still rejects an exp-LESS token. Signature, `iss` / `aud` / `nonce` and the `*_hash` checks stay enforced; `maxTokenAge` still applies even with `verifyIssuedAt: false`

For a **profiled** verify the audience/issuer floor lives in the options object,
so the assert is the (optional) third argument and options the fourth:
`aegis.verify("access_token", token, assert?, { audience })`.

### Wire parity of `VerifyOptions`

A verify knob should mean the same thing whether the token arrived as a JWT or a
CWT. Five do not yet: **`key`, `dpopProof`, `trustBoundThumbprint`, `actor` and
`typPresence` are read on the JOSE path and dropped on the COSE claims path** —
accepted and ignored rather than rejected, so a caller pinning a verification key
or requiring a DPoP proof on a CWT silently gets neither.

The contract is a value, not prose: every field has a row in the internal wire-parity
table stating which wires read it and what it resolves to per wire, and a row still
awaiting its fix carries the reason it is outstanding. Adding a field to
`VerifyOptions` fails to compile until it has a row.

One default legitimately differs per wire and always will: `typPresence` resolves to
`"required"` on JOSE (RFC 8725 §3.11 explicit typing) and `"optional"` on COSE
(RFC 9596 leaves the `typ` header optional). Passing an explicit value behaves
identically on both.

`VERIFY_OPTION_KEYS` is the exported key set, derived from that table — use it
instead of hand-listing the knobs when partitioning a flat bag of matchers and
options, so the split moves with the type:

```typescript
import { VERIFY_OPTION_KEYS } from "@lindorm/aegis";
```

## Type guards

`aegis.verify` returns a single `VerifiedToken` whose `.format` is one of seven tags. To read the opaque payload, discriminate on the two that have one:

```typescript
const v = await aegis.verify(token);
if (v.format === "jws" || v.format === "cws") {
  // v.raw holds the opaque payload; v.claims / v.custom are empty
}
```

⚠ **To ask the opposite question — "does this carry claims?" — use [`isStructuredToken`](#isstructuredtoken--does-this-result-carry-claims), not a hand-rolled `format === "jwt"`.** That shorthand is wrong in two directions at once, and both are silent.

For a raw string, `isJwtToken` / `isJwsToken` test the wire shape without an `Aegis` instance (they never throw):

```typescript
import { isJwtToken, isJwsToken } from "@lindorm/aegis";

if (isJwtToken(token)) {
  /* a well-formed JWT string */
}
```

### `isClaimsBearingToken` — verify locally, or introspect?

`isClaimsBearingToken(token)` answers the question a resource server actually has before it decides whether to verify a credential itself or introspect it (RFC 7662): **can aegis establish this token's claims locally?** Keyless, never throws.

```typescript
import { isClaimsBearingToken } from "@lindorm/aegis";

if (isClaimsBearingToken(token)) {
  const verified = await aegis.verify(token, assert, options);
} else {
  const introspection = await introspect(token); // RFC 7662
}
```

| Format                             | Claims-bearing | Why                                             |
| ---------------------------------- | -------------- | ----------------------------------------------- |
| `jwt` / `cwt` / `cwm`              | yes            | the claims layer is on the wire                 |
| `jwe` / `cwe` with a claims `cty`  | yes            | declares a nested JWT/CWT — `verify` peels it   |
| `jws` / `cws`                      | **no**         | a signature over an OPAQUE payload — no claims  |
| `jwe` / `cwe` with any other `cty` | **no**         | `verify` refuses a plaintext that is not signed |
| anything else                      | **no**         | not a token                                     |

⚠ **Do not use a wire-family check (`Aegis.isJose` / `Aegis.isCose`) for this decision.** They answer "can `verify` select a kit", which is a different question: `verify` dispatches a `jws`/`cws` perfectly happily and hands back its `raw` payload beside an **empty** `claims`. That is the right answer for `aegis.jws.verify` and a dangerous one for an authorization decision — an authorization server's opaque handle is routinely a signed token, and treating it as verified accepts it with no expiry, no revocation and no grant, while never asking the issuer that holds all three.

The encrypted rule reads the **declared** `cty` off the cleartext protected header — `JWT` / `application/jwt` / `…+jwt` (RFC 7519 §5.2) and `application/cwt` / `…+cwt` / `…+cwm` (RFC 8392), the same declarations `mint(profile, content, { encrypt })` stamps. That matches what `verify` accepts: a JWE/CWE whose plaintext is not a signed token is refused with `verify_requires_signature`, and one that declares a claims token but delivers something else with `verify_inner_type_mismatch` — so a token this predicate admits is one `verify` resolves to real claims or rejects outright, never one it resolves to an empty claims set.

### `isStructuredToken` — does this RESULT carry claims?

`isClaimsBearingToken` asks the question BEFORE verifying, of a wire string. `isStructuredToken` asks it AFTER, of a `VerifiedToken`, and narrows the result to `StructuredVerifiedToken`:

```typescript
import { isStructuredToken } from "@lindorm/aegis";

const verified = await aegis.verify(token, assert, options);

if (isStructuredToken(verified)) {
  // verified.claims / verified.custom are populated, whatever the wire
  return verified.claims.subject;
}
```

It exists because `format === "jwt"` — the obvious shorthand — drops two whole categories of valid credential, and drops them silently:

| `format`                           | Structured | Why                                                                                |
| ---------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `jwt` / `cwt` / `cwm`              | yes        | the claims layer is on the wire (`cwt`/`cwm` are COSE_Sign1 / COSE_Mac0)           |
| `jwe` / `cwe` + structured `inner` | yes        | `verify` peeled it; `claims` is **fully populated**, only the outer tag says `jwe` |
| `jws` / `cws`                      | **no**     | a signature over an opaque payload — `claims` is `{}` by contract                  |
| `jwe` / `cwe` + opaque `inner`     | **no**     | the plaintext was a `jws`/`cws`, so there is still nothing to read                 |
| `null` / `undefined`               | **no**     | swallowed deliberately — see below                                                 |

The second row is the one that bites in production: an **encrypted id_token** (OIDC `id_token_encrypted_response_alg`) verifies to `{ format: "jwe", inner: "jwt", claims: { … } }`. Every claim is there; only the outer tag differs, so a `format === "jwt"` check discards a perfectly good identity assertion and reports the user as unauthenticated.

Nullish input returns `false` rather than throwing, because the check it replaces is `if (!token || token.format !== "jwt")` — collapsing both halves into one guard is the point.

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
- A `kid` lookup is scoped to the issuer the verifier expects, or the one the artifact claims — see [Verification keys are scoped to an issuer](#verification-keys-are-scoped-to-an-issuer). Without it, a registered peer publishing a colliding `kid` could sign a token claiming another issuer's `iss` and have it verify.
- JWE payload compression (`zip` header) is rejected outright.
- Critical header parameters are enforced on **both** wires by one implementation. The two specifications agree on the duty and differ on whether a consequence is written down: RFC 7515 §4.1.11 mandates the JOSE refusal outright, while RFC 9052 §3.1 states the COSE requirement — the parameters a processor "is required to understand" — without attaching one, so aegis derives the refusal there (see the next bullet). aegis implements no `crit` extension, so any `crit` a producer sets causes verification to fail. On COSE the check reads the **protected bucket only** — the one the signature or AEAD covers — which is also where §3.1 requires every crit-listed parameter to live. On the write side a COSE `crit` member is emitted as the integer **label** its parameter is keyed under, because RFC 9052 §1.5 makes a crit member a label (`int / tstr`) and §3.1 makes a member naming a label absent from the protected bucket a fatal error.
- **A `crit` naming a parameter the header carries no value for is refused at MINT**, on both wires (`*_invalid_crit`), whether the value is absent, `undefined`, `null` or empty. Naming a parameter critical states that a recipient must understand its VALUE, so a producer supplying none is contradicting itself — and the resulting token is malformed for _every_ recipient (RFC 7515 §4.1.11, RFC 9052 §3.1) rather than merely unsupported by some, which is strictly worse than what the producer asked for. The refusal is raised where the contradiction is made, on the FINISHED protected header, because that is the only place it can still be repaired — and because a parameter a `crit` names may come from any tier the kit assembles: the JOSE header is merged from four (`buildJoseHeader`), and the COSE protected bucket carries the kit-derived `alg`, `typ` and `cty` alongside the caller's own entries (`mergeCoseProtected`). So `crit: ["alg"]` is satisfied on both wires, and a caller cannot get a different answer by choosing an encoding. The one member the two wires answer differently is `kid`: a JOSE compact serialisation has ONE header and carries it (RFC 7515 §7.1), while RFC 9052 §3.1 puts the COSE `kid` in the UNPROTECTED bucket and makes a `crit` naming a label outside the protected bucket a fatal error — so naming it critical is refused on COSE. The read side applies the same rule: `crit` naming a parameter that is absent _or_ empty is malformed.
- `crit` is answered **before** the algorithm-match, on every wire that runs both gates — the six read paths `jws`, `jwt`, `jwe`, `cws`, `cwt` and `cwm` (a `cwe` read runs `crit` and no algorithm-match at all). Both gates run ahead of the signature or AEAD cycle, so the order only decides which refusal a token tripping BOTH receives, and it is always one of the two `crit` refusals — `*_invalid_crit` when the `crit` itself is malformed, `*_unsupported_crit_param` when it is well-formed and names an extension aegis does not implement. ⚠ **That precedence is aegis policy, not a specification requirement — and the two wires do not stand on the same footing.** RFC 7515 §4.1.11 states the JOSE refusal outright ("then the JWS is invalid"). RFC 9052 §3.1 does not: it says `crit` indicates the parameters a processor "is required to understand", and its only fatal-error clause covers a _different_ condition — a crit label missing from the protected-header-parameters bucket — so the COSE refusal is aegis deriving the consequence. Neither document says which of two refusals wins. aegis answers `crit` because that is the specification's own question while the algorithm-match is aegis's defence-in-depth that no RFC asks for, and because a critical extension the reader does not implement is the producer saying the header cannot be correctly read without it. Three COSE formats (`cws`, `cwt`, `cwm`) used to answer `*_algorithm_mismatch` for such a token; they now match the JOSE ones.
- The COSE **kits** report the **protected and unprotected header buckets separately** (`protectedHeader` / `unprotectedHeader`) — that is the COSE wire, and the kit tier speaks it. The JOSE kits report an empty unprotected bucket: compact serialisation has one header and it is protected. The DOMAIN verbs report ONE `.header`, merged under the header registry's `placement` allowlist: the unprotected bucket filtered to `kid`/`iv`, then overwritten by the protected one. Nothing else read from the unprotected bucket may decide anything — `typ`, which routes the token and selects the profile floor, is protected-only, so a `typ` the signature does not cover answers nothing on either tier.
- A COSE confirmation (`cnf`) that the wire cannot carry fails **closed at mint**. RFC 8747 defines no `jkt` member for a COSE confirmation, and a JOSE thumbprint cannot be relabelled as a COSE one — RFC 7638 hashes a key's canonical JSON, RFC 9679 its canonical CBOR — so a `jkt`-bound token has no COSE form and minting one is refused rather than silently downgraded to a bearer CWT.
- The same holds for a member COSE **can** carry that arrives **malformed**: `{ jwk, kid: 42 }` is refused (`cose_cnf_member_invalid`) rather than minted with the embedded key alone. A partially-written confirmation asserts a binding narrower than its author wrote, and the verifier — satisfied by the binding it can see — stops asking about the one that vanished. A member whose value is `undefined` is **absent**, not malformed — `{ jwk: undefined, kid }` mints on the `kid` alone.
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
