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

- **Domain verbs** — `aegis.sign` / `mint` / `encrypt` / `verify` / `decrypt` / `parse`. These speak the aegis domain vocabulary. `verify` returns a unified `VerifiedToken`: domain-keyed claims split into buckets — `.claims` (registered), `.custom` (everything else), plus `.profile` / `.sensitive` — ONE domain `.header`, and a `.format` discriminant. **No `.payload`.** The single header is uniform across both wires: `protected`/`unprotected` is a COSE structural fact, and a compact JOSE token has one header and no such bucket. Provenance is kept by CONSTRUCTION instead — aegis decides which bucket a parameter may travel in (the header registry's `placement`), so the only values that can reach `.header` unauthenticated are the COSE `kid` routing hint and the `iv`. Everything a verifier routes, audits or polices a token by is protected-only: a registered parameter has no caller-chosen bucket at all on write, and one arriving in a foreign token's unprotected bucket is ignored on read. `.header` carries **no unregistered parameter** — those stop at the wire tier (see the `custom` option below).
- **The DOMAIN write options speak domain names too.** `aegis.sign` / `mint` / `encrypt` take their header bag in aegis vocabulary — `header: { objectId, contentType, critical, jwk, jwksUri, certificateUrl, zip }` — and translate it to whichever wire the call emits, so the same option produces a JOSE `oid` and the matching COSE label without the caller choosing between them. Only the **wire namespaces** below take wire-named header bags (`{ oid, cty, jku, … }`), because a kit is pure wire. Parameters the kit derives from the key or the crypto operation (`algorithm`, `keyId`, `encryption`, the certificate fields, `headerType`, the ECDH-ES party info, the IV/tag/PBKDF pair) cannot be supplied on either tier — the types omit them, and an untyped caller that names one is **refused** on both wires (`jose_reserved_header` / `cose_reserved_header`), never quietly overruled — _unless the value it names one with is EMPTY_, because a parameter that emits nothing is not a parameter. A header bag is normalised before any guard reads it: `undefined`, and the empty value of a parameter the registry says carries nothing when empty, are dropped rather than refused (`{ alg: "" }`, `{ x5c: [] }`, `{ x5t: "" }`). Nothing reaches the wire either way; what a caller does not hear is a refusal for a request that was never going to travel. The one exception is `x5t#S256`, whose empty value is **REFUSED** at the write (`header_empty_parameter`, thrown as a bare **`AegisError`** rather than the wire's own `JoseError`/`CoseError` — the verdict is wire-agnostic, so a consumer bracketing on the wire class would miss it; catch `AegisError`, which every aegis error extends) rather than dropped: it is the parameter aegis binds on, so pruning an empty one hands the audience a token with no binding where the issuer intended one, while emitting it mints a token no certificate can ever satisfy. Neither disposal is what the issuer asked for, so the write fails while the value is still in the producer's hands. The refusal is per KIT, not per parameter class: a JWT that stated an `enc` would advertise a content encryption that never happened, and a CWT that stated an `x5c` would carry the only certificate chain on the token — one no key backs. `jwksUri` is the one the kit only **defaults**: the signing key's own `jwksUri` is stamped when the caller states none, and a caller value overrides it.

- **UNREGISTERED header parameters ride their own option, `custom`** — an OPEN set on both wires, the same way an unregistered claim rides a payload. `custom: { header: { "x-my-hint": "value" } }` on a JOSE kit, `custom: { protected: … }` or `custom: { unprotected: … }` on a COSE one — compact JOSE carries ONE header and it is integrity-protected, while COSE has two buckets and an unregistered parameter has no registry row to decide which. Each wire takes only its own spelling; the other is a **compile error**, not a runtime refusal. The value travels VERBATIM — no registry codec applies, and only `undefined` is dropped, so an empty string is written as one. On COSE the key IS the label (RFC 9052 §1.5), so the parameter's own key is spelled identically on both wires.
- `header` stays **CLOSED**, which is what keeps the open set free: a misspelled `x5t#s256` is still a compile error, while a typo inside `custom` is simply a custom parameter.
- A **registered** name inside `custom` is refused (`header_registered_in_custom`) — it belongs in `header`, where its codec and placement apply — and a kit-owned one is refused distinctly (`header_kit_owned_in_custom`).
- `crit` may name a custom key — `custom.header` on JOSE, `custom.protected` on COSE: aegis refuses a `crit` that names a specification-defined parameter (RFC 7515 §4.1.11), which leaves an issuer's own extension as exactly what it is for. Never a `custom.unprotected` key — a critical parameter aegis writes always lands in the integrity-protected bucket (RFC 9052 §3.1). Reading such a token back needs the recipient's `crit` / `critical` declaration; see the crit bullets under [Security notes](#security-notes).
- ⛔ The **domain** verbs (`aegis.sign` / `mint` / `encrypt`) take no `custom` bag. The domain surface exists so a caller never learns the wire's vocabulary, and an unregistered wire parameter has no domain name by definition.

- **On READ, unregistered parameters are CARRIED, never dropped** — every wire result (`verify` / `decrypt` / `decode` on the kits) has a `custom` bag beside the typed header(s), spelled per wire exactly as the write bag is: `custom: { header }` on JOSE, `custom: { protected, unprotected }` on COSE. A foreign issuer may legitimately write parameters aegis has never heard of, and dropping them would hide what the token said; merging them into the typed bags would make `WireTokenHeader` carry keys its type says cannot exist. They **stop at the wire tier** — `VerifiedToken.header` never carries one.

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
key-registration scope — a client assertion's `iss` is the `client_id` (OIDC Core §9), and
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
// (OIDC Core §10.1). The profile floor still applies to it — the same key is
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

### Signing without a profile

`aegis.sign(input)` is the DOMAIN sign verb — `aegis.mint` minus the profile. It is **claims-only**: `format` is `jwt` / `cwt` / `cwm` and defaults to `"jwt"`, exactly as `mint` does. The **only** thing `sign` does not do that `mint` does is apply a profile's floor — no policy is enforced, no envelope claim (`iss` / `iat` / `jti` / `exp`) is generated, no typ is mandated, no algorithm class is required of the key. The token says exactly what the caller said.

The payload is a DOMAIN claim set, translated to the target wire's own spelling on the way out. So one call shape emits either wire:

```typescript
const jwt = await aegis.sign({ payload: { subject: "u1", tokenId: "t1" } });
// → {"sub":"u1","jti":"t1"}            (format defaults to "jwt")

const cwt = await aegis.sign({
  format: "cwt",
  payload: { subject: "u1", tokenId: "t1" },
});
// → CBOR {2: "u1", 7: h'7431'}          (RFC 8392 §3.1.2 / RFC 8392 §3.1.7)
```

`cwm` emits a `COSE_Mac0` and therefore needs a symmetric key (RFC 9052 §6.2); `cwt` emits a `COSE_Sign1`.

`tokenType` stamps the type header (`access_token` → `application/at+jwt` / `application/at+cwt`); a type with no structured form (`id_token`) leaves each kit's own bare form (`JWT` / `application/cwt`). `typ` overrides it outright — state it in the JOSE spelling on either wire (`at+jwt` on a `cwt` call emits `application/at+cwt`). `proprietary: true` switches the COSE side to lindorm private-use **integer** labels for claims and for the `objectId` header parameter; the default is the interoperable string spelling. Neither is a profile floor, which is why both are here as well as on `mint`.

#### Opaque signatures are the wire namespaces

There is no opaque door on `sign`. A signature over content nobody parses is `aegis.jws.sign(data, options)` / `aegis.cws.sign(data, options)`:

```typescript
const jws = await aegis.jws.sign({ subject: "u1" }); // → {"subject":"u1"}, untranslated
const cws = await aegis.cws.sign(Buffer.from([0xca, 0xfe]));
```

⚠ **Accepted cost.** These take the kits' own `JoseSignUnstructuredTokenOptions` / `CoseSignUnstructuredTokenOptions`, which are **wire-named**. An opaque caller spells wire names itself and gets no domain→wire translation: `tokenType` is the bare prefix (`"at"`, not `access_token`) and the header bag is `{ oid, cty, jku, … }`, not `{ objectId, contentType, jwksUri, … }`.

They are **not** a byte-for-byte passthrough for an _object_ payload. Both run the shared emission-boundary normalisation on a `Dict`: `undefined` is dropped; the empty value of a claim the **registry** declares carries nothing when empty is dropped too (`{ nonce: "" }` does not reach the wire; `{ scope: [] }` does); the empty value of a claim the registry declares can be neither emitted nor dropped is refused (`{ cnf: {} }` throws `AegisDomainError` with code `claim_empty_value`); a key the registry has never heard of is never touched. Nothing is renamed and nothing is added. A wire `scope` handed in as an array is serialised as that array — the space-delimited join (RFC 8693 §4.2) belongs to the domain translation, which these doors never run. A `Buffer` or a `string` is untouched — there is no object for the prune to walk. `aegis.encrypt` is the door that runs none of this at all: it seals the exact value it was handed.

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
// parsed.payload → { sub: "user-123", exp: 1737000000, aud: [...], scope: [...] } (WIRE names)
// parsed.header (WireTokenHeader — compact JOSE carries ONE header),
// parsed.custom ({ header } — the params no registry row answers for), parsed.token

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
// parsedCwt.protectedHeader / .unprotectedHeader, .custom ({ protected, unprotected }), .token

// cwm — the same, as a COSE_Mac0 (symmetric key)
const cwm = await aegis.cwm.sign({
  iss: "https://idp.example.com",
  sub: "user-123",
  exp: 1737000000,
});
const parsedCwm = await aegis.cwm.verify(cwm.token);

// cws — raw COSE_Sign1, the opaque COSE mirror of jws.
// The bag is the KIT's, so `tokenType` is the bare prefix, not the domain enum.
const cws = await aegis.cws.sign({ tid: "at_abc" }, { tokenType: "at" });
const parsedCws = await aegis.cws.verify(cws.token);
// { protectedHeader, unprotectedHeader, custom, payload, token } — payload is the Dict
// that was signed; a Buffer/string payload comes back a Buffer/string

// cwe — COSE_Encrypt0, the COSE mirror of jwe (direct AEAD to a symmetric enc key)
const cwe = await aegis.cwe.encrypt("secret");
const decryptedCwe = await aegis.cwe.decrypt(cwe.token); // { payload: Buffer }
```

### Content-type negotiation

The opaque surfaces — `jws` / `cws` / `jwe` / `cwe` — secure arbitrary `TokenContent`, and the `cty` header round-trips the native JS type on read. Sign / encrypt a `Dict` and `verify` / `decrypt` hands back a `Dict`; a `string` round-trips as a `string` (`text/plain`); a `Buffer` as a `Buffer` (`application/octet-stream`). An absent or unknown `cty` falls back to the raw `Buffer` — aegis never guesses a parse the wire did not declare.

A structured value is labelled `application/json` (RFC 8259) on **every** opaque surface, JOSE and COSE alike — same input, same declaration, `Dict` in and `Dict` out wherever it is sealed.

⚠ `aegis.encrypt` / `aegis.decrypt` are a **pure confidentiality pair** — the value you seal is the value you get back. There is no domain↔wire translation of the payload in either direction: `aegis.encrypt({ subject: "x" })` writes the key `subject`, not `sub` and not CWT claim key 2, and `aegis.decrypt` returns that object under those keys. The result carries ONE `payload` and no claim buckets: a claim is a statement by an issuer, and only a signature establishes one — read claims with `verify` or `parse`.

The CLAIMS surfaces — `jwt` / `cwt` / `cwm`, and `mint` — stamp **no** `cty` at all. A claims token's payload is a claim set by definition, so there is nothing for a `cty` to declare unless the token is nested (RFC 7519 §5.2, RFC 8392 §7.2). Supply `header: { contentType }` (domain) / `header: { cty }` (wire) to declare a nested token; a caller value always wins.

A **nested token** is labelled by its own `cty`, and `aegis.encrypt` recognises one it is handed — so `aegis.encrypt(signed.token)` and `mint(profile, content, { encrypt })` emit the same declaration:

| sealed token | `cty`              | reference                                                        |
| ------------ | ------------------ | ---------------------------------------------------------------- |
| JWT          | `JWT`              | RFC 7519 §5.2                                                    |
| JWS, JWE     | `application/jose` | RFC 7515 §9.2.1 — the bare `jose` is read too (RFC 7515 §4.1.10) |
| CWT, CWM     | `application/cwt`  | RFC 8392 §9.2 — aegis stamps a MACed CWT the same                |

Reconstruction follows the label: a JOSE token comes back as its compact `string`, a COSE token as its `Buffer`, so a sign-then-encrypt chain re-reads the inner token verbatim and `aegis.verify` opens the outer and checks the inner signature in one call.

```typescript
const sealed = await aegis.jwe.encrypt({ hello: "world" });
const opened = await aegis.jwe.decrypt<Dict>(sealed.token);
// opened.payload → { hello: "world" } (Dict in, Dict out)
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

result.format; // the token's OWN kind: "jwt" | "jws" | "cwt" | "cwm" | "cws"
result.wrapper; // the envelope it arrived in, if any: "jwe" | "cwe" | undefined
result.claims.subject; // domain-keyed registered claims
result.custom; // non-registered claims
result.header.tokenType; // domain-keyed; the two wire buckets merged, protected last
// jws/cws carry empty claims/custom and deliver the opaque payload on result.raw
```

### Encryption

⚠ **`"jwe"` is a legitimate `format` in its own right, so the PRESENCE of `wrapper` is the whole discriminator.** A bare `aegis.encrypt` result reports `{ format: "jwe" }` with no `wrapper` — its own kind IS `jwe`, and nothing encloses it. A signed token in an envelope reports `{ format: "jwt", wrapper: "jwe" }`. Reading `format === "jwe"` alone therefore never means "a signed token is inside"; check `wrapper`.

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

The JOSE guards decide on the **wire grammar** — segment count plus the header parameters the RFCs make REQUIRED (`alg`; `enc` for a JWE) — and on aegis's algorithm allowlist. `typ` is a hint, never the discriminant — aegis never requires one to classify a token (RFC 7515 §4.1.9, RFC 7519 §5.1), so a typ-less id_token, an RFC 9068 `at+jwt`, and an RFC 9449 `dpop+jwt` all read as a JWT. What separates a JWT from an opaque JWS is the payload being a JSON claims object — a signed handle stays a `jws`, including one that DECLARES `typ: JWT` over a non-claims payload. Because every JWT is a JWS (RFC 7519 §3), `isJws` is TRUE for a claims token as well; ask `isJwt` first when you need the narrow answer.

⚠ These are **wire-family** guards — they say which kit `verify` would select, not whether the token carries claims. A `jws` / `cws` passes `isJose` / `isCose` and verifies to an EMPTY claims set. To route a credential between local verification and introspection, use [`isClaimsBearingToken`](#isclaimsbearingtoken--verify-locally-or-introspect).

**`assert` is verify's claim checking, without the signature.** It takes the same `DomainAssert` matcher argument as [`aegis.verify`](#verify-assert--options), applied to any flat, domain-keyed claim dict — a set of claims that arrived some other way (an introspection response, a cached credential). `matches` returns the answer, `assert` is the throwing layer over it and names every failing top-level key (`claims_invalid`) — a root `$and` / `$or` / `$not` is named by its own key. Root and nested `$and` / `$or` / `$not` are honoured here as on `verify`. A bag the matcher refuses (an empty `$or` / `$and`, a `$not` that is not an object) throws as the matcher's own `TypeError`, on `verify` and the static doors alike; only a failed evaluation is `claims_invalid`. One vocabulary, so a **scalar** against an array-valued claim (`audience`, `scope`, `authMethods`, `roles`, `permissions`, `groups`, `entitlements`) means CONTAINS, not equals:

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

`verifyDpopProof` runs the RFC 9449 proof checks standalone — signature over the proof's embedded `jwk`, `typ: dpop+jwt`, the RFC 7638 thumbprint against the token's bound `cnf.jkt`, the RFC 9449 §7 `ath` hash of the presented access token, and `iat` freshness (default skew 60s). It needs no key resolution because the proof carries its own key, and it returns the `ParsedDpopProof`.

Reach for it when the access token is **not** locally verifiable — an opaque token's `cnf.jkt` arrives through the introspection response and the resource server validates the binding itself (RFC 9449 §6.2). `htm` / `htu` are parsed but never compared — aegis does not see the HTTP request, so that comparison belongs to the consumer.

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
// parsed.payload → wire claims ({ iss, sub, exp, jti });
// parsed.header, parsed.custom, parsed.token

JwtKit.isJwt(token); // static
JwtKit.decode(token);
// static → { header, custom, payload, signature, token } — no verification
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
// static → { header, custom, payload, signature, token } — no verification
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
// → { header, custom, payload, token }

JweKit.isJwe(token); // static
JweKit.decode(token);
// static → { header, custom, token } — headers only, no decryption
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
  //  'federationAssuranceLevel' does not exist in type 'AccessTokenContent'.
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

`required` / `forbidden` / `atLeastOneOf` are presence rules; `match` is a flat `Condition` over the domain-keyed claims (the same predicate vocabulary as `assert`); `shape` names a structural validator (`actChain`, `confirmation`, `crossField`, `events`, `subjectId`).

**The presence rules read presence two different ways, and the difference is deliberate.** Both predicates are exported, so a profile you register reads the claims the same way the floor does:

```ts
import { isClaimOmitted, isClaimSatisfied } from "@lindorm/aegis";
```

| rule                                           | question                                 | predicate          | absent means                          |
| ---------------------------------------------- | ---------------------------------------- | ------------------ | ------------------------------------- |
| `required` · `atLeastOneOf` · `requiredWhen`   | is there something a demand can bite on? | `isClaimSatisfied` | `undefined`, `null`, `""`, `[]`, `{}` |
| `forbidden` · every `shape` rule's entry guard | did the issuer name this key?            | `isClaimOmitted`   | `undefined`                           |

A demand is a demand for CONTENT: an `aud: []` addresses nobody and a `cnf: {}` binds the token to no key, so neither satisfies a `required` naming it. A prohibition is a ceiling on the issuer's VOCABULARY: naming a forbidden claim at all is the violation, whatever value it was named with. `0` and `false` are values on both readings.

At mint, a demand is also a demand for a value the token will CARRY. A registered claim whose value is not of its declared kind (`subject: 42`) is left off the wire, so a demand rule naming it refuses the mint — `profile_policy_invalid`, `Required claim "subject" is not of its declared type` — rather than issuing a token without the claim. `match` and `shape` rules still read the value as supplied.

Note `$exists` in a `match` condition is a third question again — it means NOT NULL, not "the key is present".

⚠ **`requiredWhen` short-circuits on a satisfied claim, so its `when` predicate only ever sees a value that does not satisfy the demand** — an empty one, or at mint one the writer would leave off the wire. Writing `when: (claims) => isClaimSatisfied(claims.x)` gives a rule that fires only on an unreadable value, with no error anywhere — `when` decides whether the claim is _owed_ (from the mint context, from a sibling claim), never whether it is already there.

Any failure raises `profile_policy_invalid` with `data.direction`, `data.format` and `data.invalid` — a list of every `{ key, message }` the token failed, not just the first category. (Distinct from `claims_invalid`, which means the CALLER's `assert` matchers failed.) Both name claims in the DOMAIN vocabulary — `tokenId`, never the wire's `jti` on JOSE and `cti` on COSE. They differ in whose vocabulary that is and in what `debug` adds: `claims_invalid` names the claims as the CALLER stated them and keeps the wire keys and the failing values in `debug.invalid`, while `profile_policy_invalid` names them as the PROFILE does and its `debug.invalid` is the same `{ key, message }` list as `data.invalid`.

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

**`algClass` on verify.** A profile's `algClass` is enforced on BOTH sides for the same reason. At mint it constrains key SELECTION (an asymmetric-only profile never picks an `oct` key); at verify it is checked against the algorithm the signature was verified under, and a mismatch is rejected with `algorithm_not_permitted` before any claim is looked at. `access_token`, `external_access_token` and `delegation` declare `asymmetric` because a shared MAC secret both verifies AND forges — a statement about reading someone else's token, so the verify half is the half that matters. That algorithm is not a header parameter taken on trust: every verify path refuses a header `alg` differing from the resolved key's own before it accepts the signature. A profile declaring no `algClass` is unconstrained, which is why `security_event` (RFC 8417 / SSF) still verifies an HS-signed token.

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
| `jws`        | `cws`        | Opaque handle, signed (COSE_Sign1)        |

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
- **Encrypted** — an encryptable profile minted with `encrypt` (or carrying `sensitive` fields) is sign-then-encrypted into a `COSE_Encrypt0`. Direct AES-GCM and AES-CCM (all eight RFC 9053 variants) are supported. ⚠ A `COSE_Encrypt0` carries no recipients array, so there is no recipient layer for a key-management algorithm to run in: aegis seals one **only** with a `dir` key, using the key resolved by `kid` as the content-encryption key. The twenty other key-management algorithms aegis's JWE path accepts are refused by name rather than left to fail deeper down. RFC 9052 §5.2.

### `typ` and proprietary encoding

The COSE `typ` header carries the CWT media type — `application/at+cwt`, `application/secevent+cwt`, etc. (the JWT path's `application/at+jwt` family with the `+jwt` suffix swapped for `+cwt`; bare `JWT` → `application/cwt`, the one IANA-registered CWT type).

By default the whole token is fully interoperable — a string-keyed payload that a stock COSE/CWT verifier reads, the same for any header parameter with no IANA COSE label (`objectId` → the text label `oid`, a legal COSE label — RFC 9052 §1.5), and the strict alg/enc interop gate ON. Pass `proprietary: true` for the lindorm-native compact encodings (integer-keyed `act` / `sub_id`, private-use integer labels for lindorm-only claims and header parameters, gate off), at the benefit of smaller tokens:

```typescript
await aegis.mint("access_token", content, { format: "cwt", proprietary: true });
```

Either way the signature itself is plain RFC 9052 — verified in interop tests against `@auth0/cose` and `cose-js`.

### Opaque handles (raw COSE sign — `cws`)

`aegis.cws.sign(payload, options)` is the opaque COSE mirror of `aegis.jws.sign`, and the only door onto an opaque COSE signature — `aegis.sign` is claims-only. It secures **arbitrary content**, not a claims map: a `COSE_Sign1` signs a `bstr`, so the content goes through the shared `cty` codec (Dict → `application/json`, string → `text/plain`, Buffer → octet-stream) and round-trips as the type it was. No claim label is applied and no claim name is translated — a claims-bearing `COSE_Sign1` is `aegis.cwt.sign`.

Because the token is base64url CBOR with no JOSE dot structure, a consumer cannot split it and read it as a JWT: it is an **opaque handle** (e.g. an internal reference `{ tid, sec }` signed with an unpublished key). `typ` derives from the bare `tokenType` PREFIX, and it stamps `application/cws` / `+cws` so the token reads as a CWS and never as a CWT. `verify` auto-detects it like any COSE token.

`bindCertificate` is honoured here — see **Certificate binding** below.

⚠ **An option a wire cannot honour is REFUSED by name, never accepted and ignored.** Every namespace goes through a shared guard that reads each wire's declared dispositions, so a request the chosen wire has no parameter for fails with an `AegisDomainError` (`wire_option_unsupported`) carrying the specification reason the declaration states — rather than returning a token the caller believes carries it. On COSE that is the ECDH-ES party info: a `COSE_Encrypt0` carries no recipients array and runs no recipient algorithm, so there is no key-agreement step for `partyProducer`/`partyRecipient` to feed. RFC 9052 §5.2, RFC 7518 §4.6.

```typescript
const { token } = await aegis.cws.sign(
  { tid: "ref-1", sec: "…" },
  { tokenType: "at" }, // the bare kit PREFIX — this bag is wire-named
);
const parsed = await aegis.cws.verify(token);
// { protectedHeader, unprotectedHeader, custom, payload, token } — the Dict, unmodified
```

### Certificate binding

`bindCertificate` binds a token to the X.509 certificate its signing key carries, on **both wires**. The mode decides how much travels: `"thumbprint"` (the default whenever the key has a chain) emits the SHA-256 digest alone, `"chain"` adds the full DER chain, `"none"` emits nothing.

|                | JOSE                                                      | COSE                                                                                                           |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| chain          | `x5c` — RFC 7515 §4.1.6, base64 DER                       | `x5chain`, label 33 — a `COSE_X509` (RFC 9360 §2): one certificate rides as a bare `bstr`, several as an array |
| SHA-256 digest | `x5t#S256` — RFC 7515 §4.1.8, base64url                   | `x5t`, label 34 — a `COSE_CertHash` (RFC 9360 §2), `[ hashAlg, hashValue ]`, `hashAlg` `-16` (RFC 9054 §3.2)   |
| SHA-1 digest   | `x5t` — RFC 7515 §4.1.7, always emitted beside `x5t#S256` | none — a CBOR map cannot key label 34 twice, so a COSE token names its certificate by exactly one digest       |

How many digests name the certificate is the **wire's** answer, not the caller's — there is no option that suppresses `x5t`. Emitting it costs a reader nothing: where both ride, the SHA-256 digest is what is verified and the SHA-1 one is ignored, and a token bound by the SHA-1 digest ALONE is refused outright unless `certBindingMode` is `"lax"`.

Both wires report the binding under the same domain names, so `verified.header.certificateThumbprint` and `.certificateChain` read identically whichever encoding carried the token. On the COSE read side label 34 is dispatched by its `hashAlg`: `-16` (or the registry name `"SHA-256"`) lands on `certificateThumbprint` and `-14` / `"SHA-1"` on `certificateThumbprintSha1`.

**A COSE token may also bind with SHA-384 (`-43`) or SHA-512 (`-44`)** — a conformant issuer legitimately may (RFC 9054 §3.2). aegis carries neither onto the domain header, since there is no field for one, and instead **recomputes the digest from the verifying key's own leaf certificate** and checks it there. Such a binding is verified like any other, and a mismatch is refused in both modes. Two kinds of binding are still dropped, for different reasons: SHA-512/256 (`-17`) is recognisable but has no `ShaKit` method — it is a distinct truncated variant, not SHA-512 chopped by hand — while an algorithm outside the table is not recognised at all.

**`certBindingMode` decides what a verifier does with a binding it cannot confirm** (`"strict"` by default; per-call on the five `verify` doors, construction-time on `JweKit.decrypt` / `CweKit.decrypt`, whose options type declares no such field):

| the header carries                                 | strict                                      | lax                                                   |
| -------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| the SHA-256 digest                                 | checked                                     | checked                                               |
| both digests                                       | SHA-256 checked, SHA-1 ignored              | same                                                  |
| SHA-384 or SHA-512 (COSE only)                     | checked, recomputed from the leaf           | checked, same                                         |
| the SHA-1 digest alone                             | **refused** (`cert_binding_weak_algorithm`) | compared against the key's own, and warned every time |
| a digest the verifying key has no chain to confirm | refused (`cert_binding_chain_missing`)      | warned, passed through                                |

A **mismatch is a hard fail in both modes** (`cert_binding_thumbprint_mismatch`): lax widens what may go unproven, never what may be wrong.

⚠ **A token bound with the SHA-1 digest ALONE is refused by default.** Third-party tokens carrying only `x5t` verify only under `certBindingMode: "lax"`.

```typescript
const { token } = await aegis.mint("default", claims, {
  format: "cwt",
  sign: { bindCertificate: "chain" },
});
const verified = await aegis.verify(token);
// verified.header.certificateThumbprint / .certificateChain
```

### Generic CWT and COSE encryption (`cwt` / `cwm` / `cwe`)

`cwt` is the COSE mirror of the generic `jwt`: `cwt.sign` secures already-wire COSE-name-keyed claims verbatim (no domain translation, no auto-injection), and `cwt.verify` validates them structurally + temporally (`exp` / `nbf`) exactly as `jwt.verify` validates a JWT, returning the COSE-name-keyed wire payload (`cti` / `exp`). `cwm` is the same over a symmetric key (`COSE_Mac0`). `cwe` is the COSE mirror of `jwe` — direct AEAD to a symmetric `use:"enc"` key (`COSE_Encrypt0`), returning the plaintext as raw bytes.

The COSE_Encrypt0 read refuses on two counts before the AEAD:

- **`cwe_invalid_typ`** — a `typ` naming another media family. A typ-LESS COSE_Encrypt0 is accepted, and so is a `uint` one: a CoAP Content-Format carries no media-type spelling to compare against a family, and `cwt.verify` reads the identical value the same way. RFC 9596 §2.
- **`cwe_encryption_mismatch`** — the protected header's content-encryption label disagreeing with the encryption this deployment is configured to accept (the key's own `encryption`, else `defaultEncryption`). ⚠ The label is inside the AEAD's integrity coverage, so this is not a downgrade defence: it is what makes `defaultEncryption` bind on the READ as it does on the write, and it is the same refusal `jwe.decrypt` raises. **A `cwe` token minted before that setting changes will not decrypt after it — drain outstanding tokens before rotating.**

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

`SignJwtContent` is the DOMAIN content `aegis.mint` accepts (via each profile's `SignContent`). The raw WIRE namespaces — `aegis.jwt.sign` and its COSE twins — take wire claims instead. `aegis.sign` is a DOMAIN verb like `mint`: it takes domain claims and translates them (see "Signing without a profile"). It carries the standard, OIDC, OAuth, PoP, delegation, and Lindorm claim families plus:

```typescript
{
 expires: string | Date;    // required, e.g. "1h", "30m", or a Date
 subject: string;       // required
 tokenType: string;      // required, e.g. "Bearer" / "DPoP"

 audience?: Array<string>;
 claims?: Record<string, any>; // arbitrary custom claims
 scope?: Array<string>;
 permissions?: Array<string>;
 roles?: Array<string>;
 groups?: Array<string>;
 entitlements?: Array<string>;
 username?: string;      // RFC 7662 §2.2 — NOT preferred_username, see below
 authorizationDetails?: Array<AuthorizationDetail>; // RFC 9396 (RAR) — see below
 clientId?: string;
 grantType?: string;
 tenantId?: string;
 sessionId?: string;
 nonce?: string;
 notBefore?: Date;
 authTime?: Date;
 authContextClassReference?: string;
 authFactorReference?: string;   // afr — resolved factor: 1fa | 2fa | phr | phrh
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
detail's own spec are preserved exactly. Those inner fields belong to whoever
registered the element's `type`, which determines its allowable contents, and are
not aegis's to respell (RFC 9396 §2).

⚠ **Every element must carry a `type` (RFC 9396 §2), and the claim must be an
array** (RFC 9396 §14.2). Aegis additionally requires that `type` be NON-EMPTY —
that is aegis's own strictness, in neither section. It refuses a token that
breaks any of the three, with `claim_structure_invalid` carrying `data.invalid` (one
`{ key, message }` per bad element, keyed `authorizationDetails[0].type`). The
refusal applies **on both sign and read, under every profile and under none** —
it is a fact about the claim's shape, not a policy a profile opts into — so it
also fires on `aegis.verify` and `aegis.parse` for a token somebody else wrote,
and on the static `Aegis.toWire` / `Aegis.toDomain` vocabulary doors. It does
NOT fire on the raw wire namespaces (`aegis.jwt.sign` / `aegis.jwt.verify` and
their COSE twins): those serialize and return the wire dict verbatim and run no
claim translation at all, which is what makes them the way to read a
non-conformant token when you need to see one.

The `authorizationDetails` → `authorization_details` name translation is a CLAIMS feature, so it runs wherever domain claims are written — `aegis.mint` and `aegis.sign` — and nowhere else: not on the raw wire namespaces (`aegis.jwt.sign`, `aegis.jws.sign` and their COSE twins), and not on `aegis.encrypt`, whose payload is opaque:

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

### Delegation (RFC 8693)

`act` and `mayAct` carry the RFC 8693 actor chain — who is wielding the token
(`act`) and who is permitted to become the actor (`may_act`). Both are the same
structure, and aegis imposes no depth limit on the nesting: `act.act` is the
prior actor, `act.act.act` the one before that.

Five members, and only five: `subject` → `sub`, `issuer` → `iss`, `audience` →
`aud`, `clientId` → `client_id`, and the nested `act`.

The member set is **open** — an actor is identified by whatever claims the issuer
chose, not by a fixed list — so a member aegis does not declare **rides
untouched**, at every depth, in both directions. Verbatim, not case-flipped: the
name belongs to whichever specification registered it. RFC 8693 §4.1, RFC 8693 §4.4.

⚠ **One thing is refused: two members that resolve to the same key.** A token — or
a caller — writing both `sub` and `subject` inside an actor has said two things
about one field, and picking a winner would settle it by object key order, letting
a presenter re-point the actor by appending a member the issuer never wrote. Aegis
raises `claim_structure_invalid` with `data.invalid` keyed to the position and
naming both members. This applies to every open structure, `address` included.

Only the **wire** spelling is honoured on read. (Aegis used to accept either
spelling at every depth and prefer the domain one.)

On COSE the actor members carry integer labels — `iss` 1, `sub` 2, `aud` 3
(RFC 8392 §4), plus lindorm's `client_id` 4 and nested `act` 5 — at every depth,
under `proprietary: true`. An interoperable token keeps the RFC 8693 string names.
A member with no label rides under **its own string key in the same map**
(RFC 9052 §1.5), so the compact encoding is a size decision
and never a content one.

⚠ An empty actor object is reported as an empty actor, not as no actor: `act: {}`
comes back as `{}`, which is truthy. Read a member, not the container, to decide
who is acting.

`aud` inside an actor is emitted where the caller supplies it — a deliberate
divergence from RFC 8693 §4.1. The member is kept for now because removing it
changes what a signed token says.

### Subject identifiers (RFC 9493)

`subjectId` carries a Subject Identifier — the structured statement of _who_ a
security event is about. Every one names its Identifier Format, and the format
decides which other members it must carry (RFC 9493 §3):

```typescript
await aegis.mint("security_event", {
  audience: ["https://receiver.example.com"],
  subjectId: { format: "iss_sub", iss: "https://idp.example.com", sub: "user-123" },
  events: { "https://schemas.openid.net/secevent/caep/event-type/session-revoked": {} },
});
```

Nine members, spelled in the domain vocabulary and translated to RFC 9493's on the
wire: `format`, `iss`, `sub`, `email`, **`phoneNumber` → `phone_number`**, `uri`,
`url`, `id`, and `identifiers`.

⚠ **`phoneNumber` is a rename, and the old spelling is now REFUSED.** It was
`phone_number` in the domain bag — the one structured claim that made a caller
write the wire's spelling. The wire is unchanged (`phoneNumber` resolves through
the declared member to RFC 9493's own `phone_number`), a read now returns
`phoneNumber`, and the per-format requirement check resolves the domain name
alone. ⚠ A caller still writing `phone_number` in the domain bag used to have it
carried on the open tail onto the declared member's own key; that is a collision
and is refused, so the rename must be made rather than relied on to be tolerated.

`format` is **required** on every Subject Identifier, and on every element of an
`identifiers` array (RFC 9493 §3). A missing or empty one is refused in both
directions and under every profile.

The `aliases` format nests: `identifiers` is an array of Subject Identifiers
(RFC 9493 §3.2.8), each translated and compacted at its own depth.
⚠ aegis does not refuse an `aliases` identifier nested inside one
(RFC 9493 §3.2.8).

The member set is **open**, verbatim: an Identifier Format needs no registration
(RFC 9493 §3), so a conformant identifier can carry members aegis cannot
enumerate. They ride under the producer's own spelling, and a member colliding
with a declared one is refused exactly as inside an actor.

On COSE the members carry integer labels under `proprietary: true` — `iss` 1 and
`sub` 2 (RFC 8392 §4), plus lindorm's `format` 0, `email` 4, `phone_number` 5,
`uri` 6, `url` 7, `id` 8, `identifiers` 9 — at every depth. Label 3 is left
unallocated: it is the CWT `aud` label (RFC 8392 §4), and `aud` is not a Subject
Identifier member. An interoperable token keeps the RFC 9493 string names.

The per-format requirements (RFC 9493 §3.2 — `email` for the Email format, `iss`
**and** `sub` for `iss_sub`, and so on, each required and non-empty)
are a profile `shape` rule (`subjectId`), because they are conditional on the
format rather than unconditional the way `format` itself is. `security_event`
declares it.

### Security events (RFC 8417)

`events` carries the SET events map. Its keys are **event-type URIs, not field
names** (RFC 8417 §2.2), so they are carried onto the wire and back **without case
conversion**, in both directions and on both encodings. A receiver dispatches on
the URI character for character; the house snake/camel flip every other claim key
takes would rename the event rather than translate it.

An event's payload belongs to whoever defined that event type and rides verbatim
too, empty object included (RFC 8417 §2.2) — a logout token's event payload is
normally `{}` (OIDC Back-Channel Logout §2.4), so it is kept rather
than pruned. A value that is not an object
at all does not resolve: the claim is reported as absent rather than handed back
as a scalar in a field typed as a map.
The profiles that require the claim (`logout_token`, `erasure_token`,
`security_event`) check the URI keys and the payload shapes through their `events`
shape rule.

### `__proto__` in a claim key is carried, and forges nothing

⚠ **A top-level claim key literally named `__proto__` is carried, not dropped, and forges nothing.** No bag aegis rebuilds on the way to or from the wire lets the name become its prototype, and there are three dispositions rather than one: the claim bags and the assert matcher DEFINE each key (`Object.fromEntries` at the top level, `Object.defineProperty` in the structure walker that rebuilds `act` and `sub_id`), the read-side header bags assign onto a `null`-prototype target, and the DOMAIN WRITE bag (`domainToWire`'s custom half) is a plain assignment made safe by its key transform — `snakeCase` strips leading underscores, so it cannot return `__proto__` (`__proto__`, `__PROTO__` and `--proto--` all yield `proto`). That third one is the only conversion-based disposal, and it is why the domain doors report the claim as `proto` while the WIRE doors (`jwt.sign`, `cwt.sign`) convert nothing and rely on how their bags are built.

⚠ **The guarantee stops at aegis's own bags.** A member the producer wrote under
`__proto__` is handed back as a live **own** property — so if you rebuild that bag
(`Object.assign`, a recursive clean, a hand-rolled or third-party `omit`/`pick`),
write each key with `Object.defineProperty` or into a `null`-prototype target, or
the swap happens on your side of the line. `@lindorm/utils`'s `omit*` helpers are
safe: `omitFromObject` writes every key with `Object.defineProperty`.

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
  standalone [`Aegis.matches` / `Aegis.assert`](#static-helpers). The root
  operators `$and` / `$or` / `$not` are honoured at the root and nested, on this
  door and on the static one alike. A bag the matcher refuses (an empty `$or` /
  `$and`, a `$not` that is not an object) throws as the matcher's own
  `TypeError`, on `verify` and the static doors alike; only a failed evaluation
  is `claims_invalid`.
- **`options`** (`VerifyOptions`) — the verify KNOBS. ⚠ Not yet uniform across the
  two wires: see [wire parity](#wire-parity-of-verifyoptions) below.
- **`options.critical`** — the header parameters the CALLER takes responsibility
  for. The duty to understand a critical extension is the RECIPIENT's
  (RFC 7515 §4.1.11), and aegis is never the final recipient, so a token whose
  `crit` names a parameter this call has not declared is **refused**
  (`*_unsupported_crit_param`) — including `objectId`. Declaring nothing is the
  strict default. DOMAIN names here (`["objectId"]`); the wire namespaces take
  `crit` with WIRE names (`["oid"]`), and a wire spelling at the domain door is
  refused (`crit_declaration_not_domain_named`). An unregistered custom
  parameter is spelled the same at both tiers. `aegis.decrypt` and
  `JweKit`/`CweKit` `decrypt` take the same declaration — an encrypting outer
  carries a header like any other, and `aegis.verify` of a NESTED token gates the
  outer through the decrypt door.

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
  instead. A raw source takes only a string: a condition operator under one of
  these keys is refused with `jwt_verify_unsupported_value`, naming the key
- ⚠ A raw source and its DIGEST claim (`accessToken` / `accessTokenHash`, and the
  other two pairs) resolve to ONE wire name, so stating both is refused —
  `jwt_verify_conflicting_matchers`, naming both keys. Either spelling ALONE is
  fine on `verify`; only the pair is a contradiction, because a verify handed both
  could check just one of them

`VerifyOptions` fields:

- `actor` — the delegation (`act`) policy: `required` / `forbidden` for the presence of a chain, `maxChainDepth` for its length, and `allowedActor` for who is wielding the token. `allowedActor` is matched against the CURRENT actor alone; prior actors are not read (RFC 8693 §4.1), and a token naming no actor is refused. An `allowedActor` that constrains nothing — `{}`, an all-`undefined` bag, or a logical form reducing to one, such as an `$or` with an empty alternative — places no constraint the verifier can apply, so the CALL is refused with `actor_policy_invalid` instead. A logical operator's member is read for its own defined keys, so a member carrying none (`[]`, `5`, `new Date()`) constrains nothing exactly as `{}` does
- `dpopProof` — when present, the verifier requires a `cnf.jkt` binding and validates the supplied DPoP proof
- `trustBoundThumbprint` — when `true`, allow a bound token without an inline DPoP proof (for cases where the binding is enforced out-of-band)
- `key` — per-call verification key policy; `typPresence` / `expPresence` — presence policy for the `typ` / `exp` claims
- `clockTolerance` — widen every temporal range check by N seconds in both directions, overriding the deployment-wide `clockTolerance` for this call. Applies to profiled and profile-less verify, JOSE and COSE alike
- `currentDate` — override "now" for the temporal range checks (a token expired against the real clock still verifies against a past `currentDate`); `maxTokenAge` — reject a token whose `iat` is older than N seconds (adds an independent `iat` lower bound + presence)
- `verifyExpiration` / `verifyNotBefore` / `verifyIssuedAt` / `verifyAuthTime` — per-claim temporal RANGE toggles, default `true`. Setting one to `false` skips ONLY that claim's range bound. `verifyExpiration: false` verifies an EXPIRED token — the OIDC `id_token_hint` case (OIDC Core §3.1.2.2). Presence is independent — `expPresence: "required"` still rejects an exp-LESS token. Signature, `iss` / `aud` / `nonce` and the `*_hash` checks stay enforced; `maxTokenAge` still applies even with `verifyIssuedAt: false`

For a **profiled** verify the audience/issuer floor lives in the options object,
so the assert is the (optional) third argument and options the fourth:
`aegis.verify("access_token", token, assert?, { audience })`.

### Wire parity of `VerifyOptions`

A verify knob means the same thing whether the token arrived as a JWT or a CWT:
**every field of `VerifyOptions` is read on both wires.** None is accepted on one
and silently ignored on the other.

The contract is a value, not prose: every field has a row in the internal
wire-parity table stating which wires read it and what it resolves to per wire.
Adding a field to `VerifyOptions` fails to compile until it has a row, and the
knob matrix drives one probe per option off the same key set, requiring the run
with the knob and the run without it to disagree.

Two rows record a wire limit rather than a parity gap. `dpopProof` and
`trustBoundThumbprint` both turn on a `cnf` **JWK** thumbprint binding, and aegis
has no COSE form for one: the COSE thumbprint digests a deterministically encoded
COSE_Key where the JOSE one digests a canonical JSON JWK, so the same key yields
different bytes and neither can be relabelled as the other (RFC 9679 §5.5,
RFC 7638 §3). A COSE confirmation aegis writes therefore names its key by an
embedded COSE_Key (label 1) or a `kid` (label 3) — RFC 8747 §3.1. Both options
are still read on the COSE path (a proof presented for a CWT that carries no
binding is refused there exactly as on JOSE); it is the bound-token case they
exist for that has no COSE instance.

One default legitimately differs per wire and always will: `typPresence` resolves to
`"required"` on JOSE (RFC 8725 §3.11) and `"optional"` on COSE
(RFC 9596). Passing an explicit value behaves
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

It exists because `format === "jwt"` — the obvious shorthand — drops the COSE claims formats silently:

| `format`              | Structured | Why                                                                      |
| --------------------- | ---------- | ------------------------------------------------------------------------ |
| `jwt` / `cwt` / `cwm` | yes        | the claims layer is on the wire (`cwt`/`cwm` are COSE_Sign1 / COSE_Mac0) |
| `jws` / `cws`         | **no**     | a signature over an opaque payload — `claims` is `{}` by contract        |
| `null` / `undefined`  | **no**     | swallowed deliberately — see below                                       |

**`wrapper` does not appear in that table, and that is the point.** An **encrypted id_token** (OIDC `id_token_encrypted_response_alg`) verifies to `{ format: "jwt", wrapper: "jwe", claims: { … } }` and a plain one to `{ format: "jwt", claims: { … } }` — so both answer the same test, and an envelope can never make a readable token look unreadable. A JWE over a `jws` is `{ format: "jws", wrapper: "jwe" }`: still not structured, for the same reason a bare `jws` is not.

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
- Critical header parameters are enforced on **both** wires by one implementation. The JOSE refusal follows RFC 7515 §4.1.11; the COSE one is aegis's own, derived rather than mandated (RFC 9052 §3.1 — see the next bullet). ⭐ **The duty is the RECIPIENT's, and aegis is never the final recipient**, so the read side refuses every critical parameter until the caller **declares** it: `aegis.verify(token, assert, { critical: ["objectId"] })` at the domain tier (DOMAIN names), `aegis.jwt.verify(token, assert, { crit: ["oid"] })` and `JweKit.decrypt(token, { crit: [...] })` at the wire tier (WIRE names). Declaring nothing is the strict default — every custom critical parameter is refused, and **`oid` gets no exception**: that aegis registers a parameter says nothing about whether the application behind aegis can act on it. A declared member is honoured and, for `objectId`, reported on the verified domain header for the application to act on. On COSE the check reads the **protected bucket only** — the one the signature or AEAD covers, and the bucket a crit-listed parameter must sit in (RFC 9052 §3.1). On the write side a COSE `crit` member is emitted as the label its parameter is keyed under **on that token** — the text label `oid` by default, its private-use integer under `proprietary: true`, and a custom parameter's own key unchanged. A member naming a label the protected bucket does not carry is a fatal error (RFC 9052 §1.5, RFC 9052 §3.1).
- **A `crit` naming a parameter the header carries no value for is refused at MINT**, on both wires (`*_invalid_crit`), whether the value is absent, `undefined`, `null` or empty. Naming a parameter critical states that a recipient must understand its VALUE, so a producer supplying none is contradicting itself — and the resulting token is malformed for _every_ recipient (RFC 7515 §4.1.11, RFC 9052 §3.1) rather than merely unsupported by some, which is strictly worse than what the producer asked for. The refusal is raised where the contradiction is made, on the FINISHED protected header, because that is the only place it can still be repaired — and because a parameter a `crit` names may come from any tier the kit assembles: the JOSE header is merged from four (`buildJoseHeader`), and the COSE protected bucket carries the kit-derived `alg`, `typ` and `cty` alongside the caller's own entries (`mergeCoseProtected`). The read side applies the same rule: `crit` naming a parameter that is absent _or_ empty is malformed.
- **A `crit` may only name a parameter aegis implements as an extension, or one the same call writes as a custom parameter** — checked at MINT on both wires (`*_crit_param_not_permitted`). aegis refuses a `crit` naming any specification-defined JOSE header parameter (RFC 7515 §4.1.11), which leaves `crit` for exactly the names no specification defines — so an unregistered custom entry (`custom.header` on JOSE, `custom.protected` on COSE) is nameable. `oid` is the only eligible REGISTERED name. ⚠ **The write gate and the read gate ask different questions**: may a PRODUCER name this, versus has the RECIPIENT claimed it. Both consult the registry, but only the write gate can be satisfied by it — on the read side the registry is read solely to REFUSE (a specification-defined name is malformed in a `crit`, on either wire), and acceptance then requires the caller's declaration, which is **necessary and never sufficient**: a declared member is still refused when the header does not carry it, carries it empty, or carries it in the COSE bucket the signature does not cover. So **a token aegis mints is a token aegis verifies when the verifier declares what the producer marked critical** — see the declaration in the bullet above. Two consequences worth stating: `crit: ["alg"]`, `["typ"]`, `["cty"]` and `["kid"]` are refused at the write on every wire, and a **wire** door refuses a member written in domain vocabulary (`crit: ["objectId"]`) because a wire door takes wire names — the **domain** door translates `critical: ["objectId"]` to `crit: ["oid"]` at the crossing and is unaffected.
- `crit` is answered **before** the algorithm-match, on every wire that runs both gates — the six read paths `jws`, `jwt`, `jwe`, `cws`, `cwt` and `cwm` (a `cwe` read runs `crit` and no algorithm-match at all). Both gates run ahead of the signature or AEAD cycle, so the order only decides which refusal a token tripping BOTH receives, and it is always one of the two `crit` refusals — `*_invalid_crit` when the `crit` itself is malformed, `*_unsupported_crit_param` when it is well-formed and the caller declared nothing for it. Both are reachable on both wires: an unregistered COSE label is **carried** rather than dropped (it lands in the read result's `custom` bucket under its stringified label, and the crit gate reads the header as the producer wrote it), so a foreign token's own extension marked critical reaches the second refusal exactly as it does on JOSE. ⚠ **That precedence is aegis policy, not a specification requirement — and the two wires do not stand on the same footing.** The JOSE refusal is mandated; the COSE one is aegis deriving the consequence, since the fatal-error clause there covers a _different_ condition — a crit label missing from the protected-header-parameters bucket (RFC 7515 §4.1.11, RFC 9052 §3.1). Neither document orders the two refusals. aegis answers `crit` first because the algorithm-match is its own defence-in-depth that no RFC asks for, and because a critical extension the reader does not implement is the producer saying the header cannot be correctly read without it. Three COSE formats (`cws`, `cwt`, `cwm`) used to answer `*_algorithm_mismatch` for such a token; they now match the JOSE ones.
- The COSE **kits** report the **protected and unprotected header buckets separately** (`protectedHeader` / `unprotectedHeader`), plus a `custom` bag of the same two buckets carrying the parameters no registry row answers for — that is the COSE wire, and the kit tier speaks it. The **JOSE kits report ONE `header`** and a `custom.header` beside it: compact serialisation carries a single header and it is protected, so there is no second bucket to report. Assigning either wire's result to the other's type is a compile error. The DOMAIN verbs report ONE `.header`, merged under the header registry's `placement` allowlist: the unprotected bucket filtered to `kid`/`iv`, then overwritten by the protected one. Nothing else read from the unprotected bucket may decide anything — `typ`, which routes the token and selects the profile floor, is protected-only, so a `typ` the signature does not cover answers nothing on either tier.
- A COSE confirmation (`cnf`) that the wire cannot carry fails **closed at mint**. aegis gives `jkt` no COSE label: the COSE thumbprint digests a deterministically encoded COSE_Key where the JOSE one digests a canonical JSON JWK, so the same key yields different bytes and neither can be relabelled as the other (RFC 9679 §5.5, RFC 7638 §3). A `jkt`-bound token therefore has no COSE form, and minting one is refused rather than silently downgraded to a bearer CWT.
- The same holds for a member COSE **can** carry that arrives **malformed**: `{ jwk, kid: 42 }` is refused (`cose_cnf_member_invalid`) rather than minted with the embedded key alone. A partially-written confirmation asserts a binding narrower than its author wrote, and the verifier — satisfied by the binding it can see — stops asking about the one that vanished. A member whose value is `undefined` is **absent**, not malformed — `{ jwk: undefined, kid }` mints on the `kid` alone.
- DPoP-bound tokens (`cnf.jkt`) require either a matching DPoP proof or `trustBoundThumbprint: true` on verify.
- **A confirmation that names no key is refused**, at mint and at verify, on every path. A `cnf` claim is the issuer's declaration that the presenter holds a particular key and that the recipient can confirm it (RFC 7800 §3), so a confirmation binding nothing declares a possession nobody can check. `confirmation: {}` at mint is refused instead of being dropped (which silently issued a bearer token where the caller asked for a bound one), and a token carrying `cnf: {}` or `cnf: { jkt: "" }` is refused at verify with `confirmation_binds_no_key` — including when the caller passes `trustBoundThumbprint: true`, because vouching substitutes for the PROOF and never for the binding the proof was checked against.
- **A confirmation member whose value contradicts its declared shape is refused on read**, not dropped. `cnf: { jkt: 42 }`, `{ jkt: {} }` and a `cnf` that is not an object used to be erased to nothing, and each of them then verified as a plain bearer token; a stated binding this package cannot read now fails closed. ⚠ This means `parse` refuses such a token too, which is deliberate: reporting it as stating no binding is what made it dangerous. ⚠ `cnf: { jkt: null }` **is** in this class: `cnf` is the one claim EXEMPT from the null rule below, because a null member erased before the COSE fail-closed guard runs turns a thumbprint binding into an unbound token — measured, `mint("cwt", { thumbprint: null, keyId })` minted a CWT that verified with no proof, byte-identical to a legitimate key-id binding, while `{ thumbprint: JKT, keyId }` refused `cose_cnf_unsupported`. The `jkt` value is typed by MUST (RFC 9449 §6.1), so a null one contradicts the declaration rather than leaving it unstated. ⚠ `undefined` is still absence there — `{ jwk: undefined, kid }` mints on the `kid` alone — and the asymmetry is load-bearing, not the same fault respelled: `null` reaches both wires (a JSON literal name, CBOR simple value 22 — RFC 8259 §3, RFC 8949 §3.3), while `undefined` reaches neither — JSON cannot express it, and although CBOR can (simple value 23), the COSE `cnf` carries only `jwk` (1) and `kid` (3), neither of which the DPoP gate reads.
- ⚠ **`Aegis.toDomain` is NOT signature-gated, and it is a claim door consumers use on unsigned input** (pylon reads an introspection response body through it). So every read-side rule below applies to data nobody signed, and a rule whose safety argument rests on "only the issuer could have written this" does not hold at that door. The JOSE path in particular still ACCEPTS a `cnf` carrying `jwk`/`kid` with no `jkt` — an unbound confirmation — exactly as it always has; what the null exemption above restores is that a THUMBPRINT the caller stated is never silently erased into that shape.
- **A claim value that contradicts its declared STRUCTURE is refused on read, not dropped** — uniformly, across every structured claim. `address`, `act`, `may_act` and `sub_id` used to yield nothing for a non-object and `events` did the same, while `authorization_details` already refused a non-array and `cnf` a non-object: one fault class with three dispositions. ⚠ Deployment-visible at `verify` and `parse` on both wires: a foreign token carrying `address: "Sample 1, 00100 Stockholm"` used to verify with the address silently missing and now refuses (`claim_structure_invalid`, `data.claim` naming the claim, `data.invalid` naming the position). Dropping is the dangerous half — a result reporting no address for a token whose issuer signed one is a false statement about the token, and the consumer cannot tell "none was sent" from "one was sent that I could not read". The same holds at every depth, so a member whose own codec is a structure (`act.act`, `sub_id.identifiers`) is refused too. ⚠ A LEAF codec (`text`, `int`, `date`, an array of strings) is DROPPED rather than refused — and uniformly, at every depth and in both directions: `Aegis.toWire({ subject: 42 })` and `Aegis.toDomain({ sub: 42 })` both report no subject, exactly as `address: { region: 42 }` walks to `{}` one level in. What a claim's codec tolerates is the codec's own business, so an array claim that accepts a scalar keeps it (`aud` wraps it, `scope` splits it) while one that does not drops it (`amr`). A `scope` member containing a space is refused at mint with `claim_structure_invalid` (aegis policy, RFC 6749 §3.3) — joined, it would read back as two members. ⚠ `bool` is the exception: its read arm accepts any value, so `emailVerified: "yes"` rides on both wires.
- **`null` means NOT STATED — omitted, never written, never refused, in both directions and at every depth.** `AegisProfileAddress` keeps its `| null` members so a caller minting from a database row does not have to strip the nulls first; `null` at a member, at an open structure's tail, or at a registered claim's own value is an ABSENCE rather than a value contradicting the declaration, and it is classified as one before any codec runs. ⚠ Deployment-visible: a null member of an OPEN structure (`address: { extraThing: null }`) used to ride onto the signed wire as a literal `null` and is now omitted; `cnf: null`, `authorization_details: null` and `address: null` used to be refused and are now read as claims the token does not state; a foreign token's `email_verified: null` used to be reported in a field typed `boolean`. ⚠ A REQUIRED member handed `null` now reports `"… is required and must not be empty"` where it said `"… must be the shape it declares"`. ⚠ Two things are deliberately NOT absence: an empty string, `[]` or `{}` is a stated empty value and stays governed by the registry's emptiness column; and an ARRAY ELEMENT is positional, so `authorization_details: [null]` is still refused. ⚠ An UNREGISTERED custom claim is untouched — aegis does not reshape what it has not declared, so `{ myThing: null }` still rides. ⚠⚠ And `cnf` MEMBERS are EXEMPT: see the confirmation bullet above.
- **A structured claim's member spelled in the OTHER vocabulary is refused** — on every structured claim (`address`, `authorization_details`, `act`/`may_act`, `sub_id`, `cnf`), in both directions, whether or not the real member is present alongside it. A member set is open, so a name aegis does not declare rides the tail untouched — except on the COSE `cnf`, which is a closed label map at mint (see the `cnf` bullet below); a name that resolves onto a DECLARED member's outgoing key is a different act and is refused (`claim_structure_invalid`, naming the key the two met on). ⚠ Deployment-visible in both directions: `mint`/`toWire` refuses `act: { sub: … }` or `address: { streetAddress: … }` in a DOMAIN bag, and `verify`/`parse` refuses a foreign token whose `act` carries only `subject`. A domain bag takes domain names.
- **A COSE map keying one member by BOTH its integer label and its interoperable name is refused** (`cose_duplicate_member_key`). The integer `2` and the text `"sub"` are different map keys (RFC 9052 §1.5), but they are two renderings of one declared member, so a map carrying both states two values for one field and the winner was decided by map order. ⚠ Deployment-visible on the COSE wire only, and it applies to the label-mapped claims — `act`, `may_act`, `sub_id`. Measured on a real signed CWT at `parse` **and** at `verify`: an `act` of `Map { 2 => "audited-service", "sub" => "rogue-service" }` used to read back as `{ subject: "rogue-service" }`, replacing the actor the issuer named. `address` and `authorization_details` ride verbatim and `cnf` reads integer labels only, so none of them was affected.
- **The `cnf` member set is OPEN on JOSE and CLOSED on COSE.** On JOSE a member aegis does not declare is carried **verbatim** — never case-flipped, because a confirmation method name is another specification's registered name (RFC 7800 §3.1, RFC 7800 §6.2, RFC 7800 §6.2.1). On COSE the wire is a registered label map and aegis writes only `jwk` (1) and `kid` (3), so any other member — declared or not — is refused at mint with `cose_cnf_unsupported` rather than dropped. The five aegis declares are `thumbprint` (`jkt`), `mtlsCertThumbprint` (`x5t#S256`), `key` (`jwk`), `keyId` (`kid`) and `jwkSetUri` (`jku`). ⚠ **A domain spelling in a wire `cnf` is not read as the member it looks like**: a token spelling a member `thumbprint` rather than `jkt` carries an undeclared member, and one that carries both is refused for the collision.
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
