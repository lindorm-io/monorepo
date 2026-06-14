# Aegis token construction — refactor plan / TODO

> Working implementation plan for `@lindorm/aegis`. Implements the platform's **syntax-agnostic** wire
> contract (design repo: `design/platform` ADR-0018 + `authz/token-claims.md`) in this TS library.
> Library-specific detail lives here, not in the design repo.
>
> Status: planned. Revised after a code-grounded review (see "Review fixes" markers).

## Guiding principles

1. **Functional first.** Logic in **pure utility functions** with explicit input/output; **classes are
   thin stateful wrappers** (config + per-request logger + debug logging) that delegate. No business
   logic in class bodies. Model: today's `JwtKit` ↔ `mapJwtContentToClaims` split.
2. **Additive where possible; one deliberate breaking change.** Preserve untouched: the recursive
   **decrypt-then-verify** (`Aegis.verify` `Aegis.ts:141-144`), amphora **`kid`-only** key resolution,
   the **no-header-key** security invariant (`Aegis.ts:398-408`). The exception is T1 (de-hardcoding
   `jwt.sign`) — a real breaking change handled atomically with caller migration (Issue 1).
3. **Conformance by construction.** Profiled `sign` validates the assembled claims against RFC rules
   and **throws**; profiled `verify` enforces the full §4.4 floor. Profiles _enforce_ the spec. The raw
   tier is the only, explicit bypass.
4. **Encoding-agnostic / COSE-ready.** Everything above the encoder works on a neutral claim object. A
   per-**call** `format: "jwt" | "cose"` option selects the encoder; COSE throws `NotSupportedError`
   for now. Acceptance check for every change: _would this need rewriting to emit CBOR?_ If yes, push
   it below the encoding seam.

---

## Architecture

### A1 — Three construction tiers

| Tier                      | API                                                                                        | Behaviour                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dumb / wire               | `aegis.jws.*`, `aegis.sign({ payload })`                                                   | Signs a literal payload; zero claim logic. **`payload` is `Buffer \| string`** (wire-literal). `aegis.sign({ payload })` JSON-stringifies a plain object before delegating to `JwsKit`; `aegis.jws.sign` stays `Buffer\|string` (Issue 7). The place to emit opaque handles (`{cid,gen,sec}`→`rt+jws`, `{tid,sec}`→`at+jws`). |
| Policy-free domain mapper | `aegis.jwt.sign(content)`                                                                  | Maps the domain vocabulary to wire claims; **requires/injects/validates nothing** (T1 behaviour change).                                                                                                                                                                                                                      |
| Profiles                  | `aegis.sign("<profile>", content, options?)` / `aegis.verify("<profile>", token, options)` | Domain map **+ policy**: required/forbidden/**conditional** claims, `typ`, auto-injection, lifetime, issuer source, encryptability, **runtime RFC validation** (mint) and the **full §4.4 floor** (verify). Profiles referenced by **string**; custom via `registerProfile`.                                                  |

API verbs (no `aegis.accessToken.*` namespace): **`sign` = mechanical signing (raw / no policy);
`mint` = issue a conformant token (profile)**. Distinct verbs, not an overloaded `sign` — `mint`
matches the spec's vocabulary ("at mint"), abstracts over sign vs sign-then-encrypt, and removes the
overload ambiguity.

```ts
sign(input: RawSignInput): Promise<SignedJws>;                                                   // raw / wire — UNopinionated

mint<P extends keyof ProfileContent>(profile: P, content: ProfileContent[P], options?: ProfileSignOptions): Promise<string>;  // built-in, typed — issues a conformant token (JWS, or JWE if encrypted)
mint(profile: string & {}, content: SignContent, options?: ProfileSignOptions): Promise<string>;  // custom, loose

verify(token: string, options?: VerifyJwtOptions): Promise<ParsedJwt | ParsedJws<any>>;                 // existing smart verify — UNCHANGED
verify<T extends ParsedJwt>(profile: string, token: string, options: ProfileVerifyOptions): Promise<T>; // profiled (3-arg → arity-disambiguated)
```

**Profile name → wire `typ`** (the profile descriptor's `typ`, enforced on mint + verify):
`access_token`→`at+jwt`, `id_token`→bare `JWT` (OIDC convention, not `id+jwt`), `logout_token`→`logout+jwt`,
`erasure_token`→`erasure+jwt`, `security_event`→`secevent+jwt`, `delegation`→`delegation+jwt`,
`introspection`→`token-introspection+jwt`, `client_assertion`→bare `JWT`, `userinfo`/`jarm`→none mandated,
`default`→bare `JWT`. Opaque `rt+jws`/`at+jws` are raw-tier, not profiles. When encrypted, `typ` is on
the inner JWT and the outer JWE carries `cty: application/jwt`.

### A2 — Profiles as TS subsets of one vocabulary

One `SignContent` with every domain key. Profile input types via `Pick`/`Partial` (+ our
`Optional`/`DeepPartial`, `types.ts:5,15`): **forbidden = compile error, required = non-optional**.
Wire names never appear here.

```ts
type DefaultContent = // ← Review fix: NOT all-optional
  Required<Pick<SignContent, "subject" | "expires">> & // the old floor's hard requirements
    Partial<Omit<SignContent, "subject" | "expires">>;
type AccessTokenContent = Required<
  Pick<SignContent, "subject" | "audience" | "clientId" | "expires">
> &
  Partial<
    Pick<
      SignContent,
      | "scope"
      | "confirmation"
      | "act"
      | "mayAct"
      | "authorizationDetails"
      | "roles"
      | "permissions"
      | "sessionId"
      | "authTime"
    >
  >;
type SecurityEventContent = Required<
  Pick<SignContent, "audience" | "subjectId" | "events">
> &
  Partial<Pick<SignContent, "transactionId">>;
//  aegis.sign("security_event", { subject }) → COMPILE ERROR
```

### A3 — Runtime descriptor (the real enforcement)

Types erase / are bypassable, so each profile is also a runtime descriptor. **Review fixes folded in:
`validate` is a pure function (Issue 3), conditionals added (Issue 2), `format` removed (Issue 4).**

```ts
interface TokenProfile {
  name: string;
  typ: string | null;
  required: string[]; // presence floor (wire names)
  forbidden: string[];
  requiredWhen: Array<{
    claim: string;
    when: (claims: Dict, ctx: SignContext) => boolean;
  }>; // ← C-class claims (Issue 2)
  atLeastOneOf: Array<string[]>; // ← e.g. logout: [["sub","sid"]] (Issue 2)
  autoInject: { iat: boolean; jti: boolean; nbf: boolean; iss: boolean };
  issuer: "platform" | "per-token";
  lifetime?: Duration | null; // null = no exp (SET)
  encryptable: boolean; // NOT "always encrypt" (A5)
  validate: (claims: Dict, ctx: SignContext) => InvalidEntry[]; // ← pure fn, not a predicate (Issue 3)
}
```

`SignContext` carries mint-time facts the claims object lacks (e.g. "an access token co-issued",
"max_age was requested") — needed by `requiredWhen`/`validate`; supplied by the sign caller via
`ProfileSignOptions`.

### A4 — Runtime RFC validation at mint (pure functions, NOT the predicate engine)

**Review fix (Issue 3, BLOCKER):** the existing `Predicated` matcher (`utils/.../advanced-match.ts`)
compares each key against a _static constant_ and cannot express cross-field, structured, or
every-element rules. So A4 is **pure validator functions** that return `InvalidEntry[]`, composed from
small named rules, and throw the **existing `jwt_claims_invalid` `LindormError`** (`validate.ts:18-26`)
on any failure. (Predicates stay only for _verify-side_ simple presence/equality, where operands are
caller constants.)

Rule set (each a pure fn under `internal/utils/rules/`):

- **Envelope:** `exp`/`iat`/`nbf` Unix-seconds numbers; **`exp > iat`**, **`nbf <= exp`** (cross-field);
  `iss` URI-shaped; `aud` array-of-string; **access token `aud` = exactly one** resource URI.
- **Shape:** `acr` scalar (never array); `scope`/`roles`/`amr`/`afr`/`permissions`/`groups` arrays of
  strings; **`authorization_details` every element an object with required `type`** (RFC 9396); `cnf`
  only permitted members, `jkt` correctly sized; `act`/`may_act` recursive `sub`/`iss`/`client_id`/
  nested-`act`; **`sub_id` valid RFC 9493** (`format` + that format's members); `events` object keyed
  by event-type URI.
- **Crypto floor (mint):** resolved signing key `alg` permitted for the profile — asymmetric-only for
  access tokens/SETs/DPoP; `HS*` only for confidential-client artifacts; FAPI allowlist
  (`PS256`/`ES256`/`EdDSA`) under FAPI; `alg: none` never. Hash-claim lengths match digest (T3).

Raw tier runs none of this. **Profiles guarantee conformance; raw is on-your-own.**

### A5 — Encryption: conditional, with an explicit key path

**Review fix (Issue 5):** profiled sign takes a third `ProfileSignOptions` carrying the recipient
(client) enc-key selector; encryption never defaults on.

```ts
interface ProfileSignOptions {
  format?: "jwt" | "cose"; // per-call encoder (Issue 4); default "jwt"
  context?: Partial<SignContext>; // co-issue facts for requiredWhen/validate
  encrypt?: {
    kid?: string;
    algorithm?: KryptosEncAlgorithm;
    encryption?: KryptosEncryption;
    predicate?: AmphoraPredicate;
  };
}
```

Sign-then-encrypt (reusing `JweKit`, `cty: application/jwt`) fires only when _(a)_ `profile.encryptable`
**and** _(b)_ `options.encrypt` is supplied (→ `jweKit({ encrypt:true, id, predicate })`, the existing
`EncOptions` path `Aegis.ts:367-391`), or _(c)_ content has `sensitive_identity` (forced within
`id_token`; no key ⇒ omit the claim per `token-claims.md:98`). Never encryptable: access/SET/logout/
erasure/DPoP.

### A6 — Verify floor is NEW work, not assumed

**Review fix (Issue 6, BLOCKER):** today's verify does NOT meet §4.4 — `exp`/`nbf` are enforced only
_if present_ (`jwt-verify.ts:78-90` `$or:[{$exists:false}, …]`), and `iss`/`aud`/`typ` are checked only
when the caller passes them (`Aegis.jwtVerify` never passes `this.issuer`). Profiled `verify` MUST add,
unconditionally: **`exp` presence** (when `profile.lifetime !== null`), **`iss` exact-match** against
the profile's issuer source, **`aud` contains self**, **`typ` === profile.typ**, plus the existing
`alg:none`/allowlist rejection (already enforced, `jose-header.ts:82-90`) and 0s default tolerance.

---

## Interface changes

- **Unchanged:** `IJwsKit`, `IJweKit`, `IAegisAes`/`IAegisJwe`/`IAegisJws`, recursion, amphora `kid`
  resolution, no-header-key invariant, existing `verify(token, options)` overloads.
- **`IJwtKit`/`IAegisJwt`:** behaviour change only (T1) — signature stays; stops forcing/injecting.
- **Added to `IAegis`:** the `sign` overloads (+ optional `ProfileSignOptions`), the profiled `verify`
  overload, `registerProfile`.
- **New types:** `SignContent`, the `Pick`/`Partial` content types + `ProfileContent` map,
  `TokenProfile`, `SignContext`, `RawSignInput`, `ProfileSignOptions`, `ProfileVerifyOptions`,
  `InvalidEntry`.

## File layout (functional; Issue 8)

```
internal/profiles/
  registry.ts                 resolveProfile(name) / registerProfile()
  definitions/                default, access-token, id-token, logout-token, erasure-token,
                              security-event, delegation, client-assertion, introspection,
                              userinfo, jarm            ← Issue 9: + userinfo, jarm
internal/utils/
  map-content-to-claims.ts    refactor of jwt-payload.ts (policy injected, not hardcoded)
  build-profile-claims.ts     apply autoInject / lifetime / issuer to neutral claims
  validate-profile-claims.ts  pure-function validator (NOT predicates)
  rules/                      require-present, forbid-present, required-when, at-least-one-of,
                              cross-field, every-element-has-key, sub-id-shape, act-chain-shape,
                              aud-single-resource, cnf-shape, events-shape, alg-permitted
  select-encoder.ts           format → jwt encoder | cose throws NotSupportedError
internal/claims/
  sub-id.ts (RFC 9493)        events.ts (SET events)
```

Refresh/opaque access tokens (`rt+jws`/`at+jws`) are emitted via the **raw tier** + a thin
`internal/utils/build-opaque-handle.ts` helper (Issue 9). JAR/CIBA are verify-side request objects and
DPoP is client-minted (existing `verifyDpopProof`) — **out of scope for mint profiles**; add verify
profiles later if needed.

## Test matrix (Issue 8)

- **Unit (pure utils):** every `rules/*` fn (valid + each failure mode; snapshot `invalid[]`);
  `map-content-to-claims` (domain→wire incl. `cnf`/`act`/hashes); `build-profile-claims` (autoInject
  on/off, `lifetime:null` ⇒ no `exp`, platform vs per-token issuer); `resolveProfile`/`registerProfile`
  (unknown throws, custom registers); `select-encoder` (cose throws).
- **Drift guard:** each `*Content` type's required keys === descriptor `required`.
- **Profile conformance (per built-in):** happy-path snapshot + each forbidden claim throws + each
  required-omitted throws. Specifically: `security_event` forbids `exp`/`sub`, requires `sub_id`/`events`;
  `id_token` EdDSA & ML-DSA-65 ⇒ SHA-512/256-bit `at_hash`, RS256 ⇒ SHA-256/128-bit (T3); `access_token`
  `aud` exactly one + `HS*` rejected; `logout_token` `atLeastOneOf [["sub","sid"]]` + `nonce` forbidden.
- **Verify floor (new):** missing `exp` rejected; wrong `iss` rejected; `aud` not containing self
  rejected; wrong `typ` rejected.

---

## Tasks (sequenced)

- [x] **T3 — OIDC hash conformance** ✅ DONE (create-hash.ts: suffix-less→SHA-512; truncation=left-most half of the actual digest; mint+verify round-trip tests for EdDSA/ML-DSA-65 added; full aegis suite green). _(FIRST — independent, de-risks ID-token tests). Touches mint AND
      verify (the same `create-hash` fns back `jwt-payload.ts:87-103` and `jwt-verify.ts`/`jwt-validate.ts`),
      so cover verify-side hash matching too (Issue 10)._

  > **Task: make aegis's `at_hash`/`c_hash`/`s_hash` conform.** Read first; quote lines; don't guess.
  >
  > 1. **Hash alg = the ID token signing alg's hash:** name ends `256`/`384`/`512` → SHA-256/384/512;
  >    **EdDSA → SHA-512** (Ed25519 & Ed448, no `crv` branch); **ML-DSA-44/65/87 → SHA-512**. Every
  >    size-less alg name uses SHA-512, not SHA-256.
  > 2. **Truncation = base64url of the left-most HALF of that digest, uniformly:** SHA-256→128b,
  >    SHA-384→192b, SHA-512→256b; **derive from actual digest size; do not hardcode per-claim bits.**
  >    Today `createCodeHash` hardcodes 256b → full SHA-256 digest (bug); `createAccessTokenHash`/
  >    `createStateHash` hardcode 128b → half-length on SHA-512 (bug).
  >
  > Where: `internal/utils/create-hash.ts` (`shaAlgorithm()` line 13 fallback; truncation lines 33/36/39).
  > Callers: `internal/utils/jwt-payload.ts`, `jwt-verify.ts`, `jwt-validate.ts`. Extend unit tests for
  > EdDSA- and ML-DSA-65-signed cases (SHA-512/256-bit) on **both mint and verify**, keep RS256/ES512
  > passing. Do **not** change JWE `cty: application/jwt`; PBES2 (16-byte salt, p2c 90 000–110 000);
  > recipient enc-key selection; newest-active signing-key selection. Report the diff + tests added.

- [~] **T1+T2 — De-hardcode `JwtKit` + profile engine (LAND TOGETHER; Issue 1 + Issue 10).**
  - ✅ FOUNDATION DONE: policy-free `mapContentToClaims` + `buildProfileClaims`; `JwtKit.sign` de-hardcoded;
    profile `registry` + `TokenProfile` type + `default` profile (faithful drop-in — zero snapshot churn);
    `aegis.sign` raw + `sign("default", …)` overloads; ALL callers migrated (pylon fixtures/example, aegis
    tests). aegis 321 + pylon 1269 green; typecheck/build clean.
  - ✅ DONE: `sign(profile)`→`mint()` rename + all callers migrated; all 10 built-in profiles
    (access_token, id_token, logout_token, erasure_token, security_event, delegation, client_assertion,
    introspection, userinfo, jarm) + `sub_id`(RFC 9493)/`events` models + per-token issuer; §4.4 verify
    floor (A6: typ/iss/aud/exp). aegis 417 green, pylon 1269 green, typecheck/build clean.
  - Refactor `mapJwtContentToClaims` so policy is injected (`map-content-to-claims`); `jwt.sign` becomes
    policy-free.
  - Build the profile engine: `SignContent` vocab, `Pick`/`Partial` content types + `ProfileContent`
    map, `TokenProfile` descriptors + `registry`, `sign`/`verify` overloads, `build-profile-claims`,
    `select-encoder` (cose throws).
  - `default` profile re-imposes the old floor (requires `subject`+`expires`, injects `iss/iat/jti/nbf`)
    so it is a faithful replacement.
  - **Migrate every in-repo caller of `aegis.jwt.sign` that relied on injection** to `sign("default", …)`
    in the SAME change: `packages/pylon/src/__fixtures__/socket-auth/mint-test-access-token.ts:23`,
    `packages/pylon/example/routers/test/authorize.ts:8`, `packages/aegis/src/classes/Aegis.test.ts`
    - `Aegis.cert.test.ts` (update snapshots). Verify nothing else in the monorepo calls it.
  - Built-ins: `default, access_token, id_token, logout_token, erasure_token, security_event,
delegation, client_assertion, introspection, userinfo, jarm`. Add `sub_id` (RFC 9493) + `events`
    models. Per-token `issuer` honoured only when `issuer:"per-token"`.
  - **Profiled verify adds the §4.4 floor (A6) as new enforcement.**

- [x] **T4 — Runtime RFC validators (A4).** ✅ DONE (with T1+T2 — pure-function `rules/*` library +
      `validate-profile-claims` wired into `mint`; `jwt_claims_invalid` error shape). `validate-profile-claims` + `rules/*` pure functions;
      each profile's `validate`/`requiredWhen`/`atLeastOneOf`; wire into profiled `sign`. Keep
      `jwt_claims_invalid` error shape. (Depends on the Issue-3 resolution: functions, not predicates.)

- [x] **T5 — Encryption trigger + key flow (A5).** ✅ DONE. `mintProfile` now sign-then-encrypts via the
      existing `jweKit({ encrypt: true, id, algorithm, predicate })` → `EncOptions` path when
      `profile.encryptable` AND (`options.encrypt` supplied OR content carries `sensitive_identity`). The inner
      signed JWT keeps the profile typ; `JweKit.encrypt` sets `cty: application/jwt` automatically from the inner
      token shape (no manual threading needed). Read side unchanged — `verifySmart` recursion decrypts then
      verifies the inner JWT, and `enforceVerifyFloor` runs on the inner claims/typ. Non-encryptable profile +
      `encrypt` ⇒ `AegisError` code `encryption_not_allowed`. `sensitive_identity` is omitted (stripped before
      signing) when no enc key resolves; explicit `encrypt` with no key surfaces the find error. `kryptosEnc`
      encrypt branch now honours `options.algorithm`.

- [x] **T6 — COSE seam.** ✅ DONE. `internal/utils/select-encoder.ts` (pure `selectEncoder(format)` →
      `{ format }` for `"jwt"`, throws `AegisError` code `cose_not_supported` for `"cose"`). `format?` added to
      `ProfileSignOptions`/`ProfileVerifyOptions` (default `"jwt"`). Wired at the top of `mintProfile` and
      `verifyProfile` so `format: "cose"` throws before any key/sign/decode work. Mapping/profiles/validation
      stay encoding-neutral. Full COSE/CWT is the separate deferred initiative.

## Resolved review items (for the record)

1. Predicate engine inadequate for A4 → pure validator functions (A4). 2. T1 is breaking → land with
   T2 + caller migration; `default` requires subject/expires (A2/T1+T2). 3. Verify floor unenforced today
   → profiled verify adds it (A6). 4. Enc key flow → `ProfileSignOptions.encrypt` (A5). 5. Conditional
   claims → `requiredWhen`/`atLeastOneOf` (A3). 6. `format` per-call not per-profile (A5/A6). 7. Raw
   `payload` is `Buffer|string`; objects JSON-stringified by `aegis.sign` (A1). 8. Built-ins +userinfo/jarm;
   refresh/opaque via raw helper; JAR/CIBA/DPoP out of mint scope (file layout).
