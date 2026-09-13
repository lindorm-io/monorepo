/**
 * The single claim registry: the one place that maps each aegis DOMAIN claim to
 * its spelling on EVERY wire and to how its value is shaped. Both encoders
 * consume it — JOSE takes `domain → wire.jose`, COSE `domain → wire.cose` — so a
 * claim is defined exactly once.
 *
 * It is built on the shared {@link ParamSpec} base (`internal/registry/`), which
 * the header registry shares: a claim and a header parameter are the same kind of
 * thing — a named parameter with a wire spelling, a value shape and an emptiness
 * verdict.
 *
 * The `domainClaim` marks below ARE the `DomainClaims` set — what the verify-floor
 * read resolves — and a drift-guard test freezes those names and binds them to the
 * `DomainClaims` type in both directions.
 *
 * --- The COSE map-key rule (byte-size minimisation) ---
 *
 * `wire.cose` decides the CBOR map key for a claim: pick whichever key is smaller
 * on the wire. A private-use integer label (`< -65536`) always encodes to 5 CBOR
 * bytes; an N-character string key encodes to N + 1 for N < 24 and N + 2 above.
 * So the integer wins only where the JOSE name is 5 characters or longer.
 *
 *   (a) a registered IANA CWT Claims label (1–9): always that integer —
 *       untouched by the byte-size rule. RFC 8392 §4 assigns 1–7 and RFC 8392 §9.1
 *       establishes the registry; RFC 8747 §7.1.1 assigns `cnf` 8. ⚠ `scope` 9
 *       is a registry entry no RFC in the local specification library states —
 *       see the open question in `TODO-MONOREPO.md`;
 *   (b) `wireName(...)` ⇒ no registered label AND a short JOSE name (≤ 4 chars):
 *       the JOSE string name is the CBOR map key on- and off-platform, so a stock
 *       verifier reads it;
 *   (c) a private-use integer label (`< -65536`, via `P(n)`) ⇒ no registered label
 *       but a long JOSE name: the compact integer on-platform, degrading to the
 *       `WireKey`'s `name` off-platform (mint option `proprietary: false`, see
 *       `internal/cose/cwt-claims.ts`). Such a claim is NEVER dropped.
 *
 * ⛔ THE PRIVATE-USE LABELS ARE APPEND-ONLY. Renumbering to keep the declaration
 * order tidy silently reinterprets every CWT already issued.
 *
 * No claim is `absent` on either wire — every claim rides both. The `absent` arm
 * of {@link WireKey} is exercised by the header registry.
 *
 * --- The empty-value column ---
 *
 * `whenEmpty` is REQUIRED on every entry ({@link ClaimSpec.whenEmpty}) and has no
 * default, because both answers fail open in a different direction: a blanket keep
 * fabricates assertions the issuer never made (`amr: []` reads as "the methods are
 * known and none applied"), and a blanket prune strips restrictions (an RFC 9396
 * `actions: []` grants no action, while an ABSENT `actions` is not restricted by
 * action at all). Each cell is a decision; the ones a reader would question carry
 * their reason inline.
 *
 * --- What this registry does NOT declare ---
 *
 * ⛔ NO `direction`, `matchable` OR `provenance` COLUMN. Each would be constant or
 * near-constant, and the question each would answer is already asked in code: the
 * translator iterates this table in both directions (`domainToWire` /
 * `wireToDomain`), `jwt-identity-matchers.ts` builds a predicate for ANY key
 * resolving via `claimByDomain`, and "is there a caller door, and which one?" is
 * executed by `__fixtures__/spec-dispositions.ts`. A column that answers a
 * question the code is already asking is load-bearing; one invented to look
 * complete is a second source of truth waiting to disagree.
 */

import type { ClaimSpec } from "../registry/claim-spec.js";
import type { WireNamed } from "../registry/param-spec.js";
import type { Wire } from "../registry/wire.js";
import {
  type WireKey,
  wireKeyLabel,
  wireKeyName,
  wireLabel,
  wireName,
} from "../registry/wire-key.js";

import { ACT_MEMBERS, ACT_SAMPLE } from "./act-members.js";
import { ADDRESS_MEMBERS, ADDRESS_SAMPLE } from "./address-members.js";
import {
  AUTHORIZATION_DETAIL_MEMBERS,
  AUTHORIZATION_DETAILS_SAMPLE,
} from "./authorization-details-members.js";
import { SUB_ID_MEMBERS, SUB_ID_SAMPLE } from "./sub-id-members.js";

export type { ClaimCodec, ClaimSpec } from "../registry/claim-spec.js";

// The first private-use COSE label below the -65536 boundary. ⛔ Append-only —
// see the file docstring.
const P = (n: number): number => -65537 - n;

// --- entry shorthands --------------------------------------------------------

/** JOSE name; string-keyed on COSE under the same name (the byte-size rule). */
const named = (jose: string): Record<Wire, WireKey> => ({
  jose: wireName(jose),
  cose: wireName(jose),
});

/**
 * JOSE name + COSE integer label. `cose` is the COSE STRING name, which differs
 * from the JOSE name only where RFC 8392 §3.1.7 renamed the claim (`jti` → `cti`); it
 * is both the off-platform degraded key and the vocabulary `domainToWire` speaks
 * when bound to `coseName`.
 */
const labelled = (jose: string, label: number, cose = jose): Record<Wire, WireKey> => ({
  jose: wireName(jose),
  cose: wireLabel(label, cose),
});

/**
 * The two representative NumericDate samples, split by {@link ClaimSpec.temporal}.
 *
 * ⚠ ONE sample cannot serve both marks. A `temporal: "past"` claim must not be in
 * the future and a `temporal: "future"` claim must not be in the past
 * (`jwt-temporal-matchers.ts`), so one instant given to both leaves at least one
 * unverifiable at any clock — and a consumer of these samples has to be able to
 * build a token that VERIFIES, or the column proves nothing.
 *
 * `updatedAt` is a `date` with NO temporal mark — a profile timestamp, never
 * range-checked — and takes the past sample.
 */
const SAMPLE_PAST_DATE = new Date("2023-12-31T00:00:00.000Z");
const SAMPLE_FUTURE_DATE = new Date("2026-01-01T00:00:00.000Z");

/**
 * The registry. Order groups by COSE-key category for readability; lookups are
 * by the derived maps below, not by position.
 */
export const CLAIM_SPECS: ReadonlyArray<ClaimSpec> = [
  // --- (a) IANA-registered CWT claims (integer labels 1–9) ---
  {
    domain: "issuer",
    spec: {
      kind: "rfc",
      rfc: "RFC 7519",
      section: "4.1.1",
      url: "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.1",
    },
    wire: labelled("iss", 1),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "https://issuer.lindorm.test",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "subject",
    spec: {
      kind: "rfc",
      rfc: "RFC 7519",
      section: "4.1.2",
      url: "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.2",
    },
    wire: labelled("sub", 2),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "subject_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "audience",
    spec: {
      kind: "rfc",
      rfc: "RFC 7519",
      section: "4.1.3",
      url: "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.3",
    },
    // RFC 7519 §4.1.3 — a scalar WRAPS to a single-element array.
    wire: labelled("aud", 3),
    codec: { kind: "array", scalar: "wrap" },
    sensitivity: "public",
    sample: ["https://api.lindorm.test"],
    bucket: "claims",
    // KEEP: `aud: []` names NOBODY where an absent `aud` restricts nothing
    // (RFC 7519 §4.1.3), so pruning turns the narrowest statement the issuer can
    // make into the widest.
    whenEmpty: "keep",
    domainClaim: true,
  },
  {
    domain: "expiresAt",
    spec: {
      kind: "rfc",
      rfc: "RFC 7519",
      section: "4.1.4",
      url: "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4",
    },
    wire: labelled("exp", 4),
    codec: { kind: "date" },
    sensitivity: "public",
    sample: SAMPLE_FUTURE_DATE,
    bucket: "claims",
    whenEmpty: "prune",
    temporal: "future",
    domainClaim: true,
  },
  {
    domain: "notBefore",
    spec: {
      kind: "rfc",
      rfc: "RFC 7519",
      section: "4.1.5",
      url: "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.5",
    },
    wire: labelled("nbf", 5),
    codec: { kind: "date" },
    sensitivity: "public",
    sample: SAMPLE_PAST_DATE,
    bucket: "claims",
    whenEmpty: "prune",
    temporal: "past",
    domainClaim: true,
  },
  {
    domain: "issuedAt",
    spec: {
      kind: "rfc",
      rfc: "RFC 7519",
      section: "4.1.6",
      url: "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.6",
    },
    wire: labelled("iat", 6),
    codec: { kind: "date" },
    sensitivity: "public",
    sample: SAMPLE_PAST_DATE,
    bucket: "claims",
    whenEmpty: "prune",
    temporal: "past",
    domainClaim: true,
  },
  // RFC 8392 §3.1.7 `cti`. A PER-WIRE codec: a text string on JOSE, its raw UTF-8
  // bytes on COSE. The `encoding` cell says WHICH bytes — the token id's own
  // UTF-8, not a decode of some alphabet, where the three OIDC hashes take `b64u`.
  {
    domain: "tokenId",
    spec: {
      kind: "rfc",
      rfc: "RFC 7519",
      section: "4.1.7",
      url: "https://www.rfc-editor.org/rfc/rfc7519#section-4.1.7",
    },
    wire: labelled("jti", 7, "cti"),
    codec: { kind: "text", per: { cose: { kind: "bstr", encoding: "utf8" } } },
    sensitivity: "public",
    sample: "token_id_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // RFC 8747
  {
    domain: "confirmation",
    spec: {
      kind: "rfc",
      rfc: "RFC 7800",
      section: "3.1",
      url: "https://www.rfc-editor.org/rfc/rfc7800#section-3.1",
    },
    wire: labelled("cnf", 8),
    codec: { kind: "bespoke", bespoke: "confirmation" },
    sensitivity: "public",
    // `keyId` and `key` are the two confirmation forms both wires carry; the
    // other three are `wireAbsent` on COSE (`internal/claims/cnf-members.ts`).
    // The sample uses `keyId`.
    sample: { keyId: "key_sample" },
    bucket: "claims",
    // REFUSE: RFC 7800 §3.1 `cnf` IS the proof-of-possession requirement, so
    // pruning it hands the audience a BEARER token, and an empty one names no key
    // to confirm, so keeping it emits a binding nothing can satisfy. Refused at
    // every door: the translator (`internal/claims/translate.ts`), the emission
    // boundary (`refuse-empty-claims.ts`) and the verify policy gate
    // (`internal/utils/apply-verify-policy.ts`).
    whenEmpty: "refuse",
    domainClaim: true,
  },
  // RFC 8693
  {
    domain: "scope",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.2",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.2",
    },
    wire: labelled("scope", 9),
    codec: { kind: "array", scalar: "spaced" },
    sensitivity: "public",
    sample: ["openid", "profile"],
    bucket: "claims",
    // KEEP. ⛔ THIS IS AEGIS POLICY, NOT A CITATION — do not attach RFC 6749 §3.3
    // to it, which governs an AUTHORIZATION SERVER handling a request, not a
    // recipient reading a claim.
    //
    // The policy: `scope` is only a SHOULD on an access token (RFC 9068 §2.2.3),
    // so a verifier cannot tell an absent `scope` from a grant that never had one
    // — which is what gives an EXPLICIT empty list something to say, and pruning
    // would erase the one statement that ambiguity leaves an issuer able to make.
    //
    // ⚠ The four lindorm authority lists (`roles`/`permissions`/`entitlements`/
    // `groups`) PRUNE instead, and the differentiator is NOT "spec-governed vs
    // ours": it is that those four are our own vocabulary whose sole issuer, tyr's
    // access-token mint, already emits an empty list as absence. A sixth list
    // lands on "prune" by that rule.
    whenEmpty: "keep",
    domainClaim: true,
  },

  // --- (b) No registered integer label AND a short JOSE name (≤ 4 chars):
  //     string-keyed in CBOR (interoperable; the string key is the smaller
  //     encoding).
  {
    domain: "authContextClassReference",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "2",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.2",
    },
    wire: named("acr"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "urn:lindorm:acr:mfa",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "authMethods",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "2",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.2",
    },
    wire: named("amr"),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["pwd", "otp"],
    bucket: "claims",
    // PRUNE: a DESCRIPTION of how the subject authenticated, not a restriction —
    // `amr: []` asserts "the methods are known and none applied", which no issuer
    // means and no audience can act on.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "authorizedParty",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "2",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.2",
    },
    wire: named("azp"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "client_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "vectorOfTrust",
    spec: {
      kind: "rfc",
      rfc: "RFC 8485",
      section: "3.2",
      url: "https://www.rfc-editor.org/rfc/rfc8485#section-3.2",
    },
    wire: named("vot"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "P1.Cc.Cd",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "vectorTrustMark",
    spec: {
      kind: "rfc",
      rfc: "RFC 8485",
      section: "3.2",
      url: "https://www.rfc-editor.org/rfc/rfc8485#section-3.2",
    },
    wire: named("vtm"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/vtm",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // RFC 8693
  {
    domain: "act",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.1",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.1",
    },
    wire: named("act"),
    // A DECLARED, RECURSIVE and OPEN member set (RFC 8693 §4.1, RFC 8693 §4.4) — see
    // `act-members.ts`. The nested `act` member names ACT_MEMBERS itself, which is
    // what the `children` thunk exists for; `"verbatim"` and not `"flip"` because
    // a tail member is another specification's JWT claim name.
    codec: { kind: "object", children: () => ACT_MEMBERS, open: "verbatim" },
    sensitivity: "public",
    sample: ACT_SAMPLE,
    bucket: "claims",
    // REFUSE: `act` (RFC 8693 §4.1) makes the token a delegated one, and an actor
    // object with no member names nobody a verifier could hold to that
    // delegation — pinned by `scenarios.ts`
    // "an-actor-that-identifies-nobody-is-refused-before-it-is-signed".
    whenEmpty: "refuse",
    domainClaim: true,
  },
  {
    domain: "grantType",
    spec: {
      kind: "policy",
      why: "lindorm's record of the OAuth grant type the token was minted under; no registry defines `gty`.",
    },
    wire: named("gty"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "authorization_code",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // OIDC front-channel logout
  {
    domain: "sessionId",
    spec: {
      kind: "oidc",
      doc: "OIDC Front-Channel Logout",
      section: "3",
      url: "https://openid.net/specs/openid-connect-frontchannel-1_0.html#rfc.section.3",
    },
    wire: named("sid"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "session_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // RFC 8417 txn — no `domainClaim` mark, so the TOKEN read resolves it (it is a
  // `TokenClaims` key) and the floor leaves it in `custom` under `txn`.
  {
    domain: "transactionId",
    spec: {
      kind: "rfc",
      rfc: "RFC 8417",
      section: "2.2",
      url: "https://www.rfc-editor.org/rfc/rfc8417#section-2.2",
    },
    wire: named("txn"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "txn_sample",
    bucket: "claims",
    whenEmpty: "prune",
  },
  // ISO/IEC 29115
  {
    domain: "levelOfAssurance",
    spec: {
      kind: "policy",
      why: "lindorm's resolved assurance level; ISO/IEC 29115 defines the concept and its levels, never a claim name.",
    },
    wire: named("loa"),
    codec: { kind: "int" },
    sensitivity: "public",
    sample: 2,
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // NIST SP 800-63B
  {
    domain: "authenticatorAssuranceLevel",
    spec: {
      kind: "policy",
      why: "lindorm's NIST SP 800-63B AAL carrier; the publication defines the level, not a claim name.",
    },
    wire: named("aal"),
    codec: { kind: "int" },
    sensitivity: "public",
    sample: 2,
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // NIST SP 800-63A
  {
    domain: "identityAssuranceLevel",
    spec: {
      kind: "policy",
      why: "lindorm's NIST SP 800-63A IAL carrier; the publication defines the level, not a claim name.",
    },
    wire: named("ial"),
    codec: { kind: "int" },
    sensitivity: "public",
    sample: 2,
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // NIST SP 800-63C
  {
    domain: "federationAssuranceLevel",
    spec: {
      kind: "policy",
      why: "lindorm's NIST SP 800-63C FAL carrier; the publication defines the level, not a claim name.",
    },
    wire: named("fal"),
    codec: { kind: "int" },
    sensitivity: "public",
    sample: 2,
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // The resolved (primary) auth factor — ONE value (1fa/2fa/phr/phrh), not the
  // categories it was made of; `afc` below carries those.
  {
    domain: "authFactorReference",
    spec: {
      kind: "policy",
      why: "lindorm's single resolved auth-factor value on `afr`; the registered authentication-method values ride the separate `amr` claim in this registry. RFC 8176 §2.",
    },
    wire: named("afr"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "2fa",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // PSD2 SCA categories (knowledge/possession/inherence) — the axes exercised.
  {
    domain: "authFactorCategories",
    spec: {
      kind: "policy",
      why: "lindorm's PSD2-SCA category axes; the regulation names the categories, no registry names the claim.",
    },
    wire: named("afc"),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["knowledge", "possession"],
    bucket: "claims",
    // PRUNE: the `amr` argument — a description of the factors used.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "sessionHint",
    spec: { kind: "policy", why: "lindorm's opaque session correlator." },
    wire: named("sih"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "session_hint_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "subjectHint",
    spec: { kind: "policy", why: "lindorm's opaque subject correlator." },
    wire: named("suh"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "subject_hint_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },

  // --- (c) No registered integer label but a long JOSE name (≥ 5 chars):
  //     a private-use integer label (5 bytes) beats the string key (name + 1).
  //     ⚠ `nonce` here is the OIDC Core §2 request binding; CWT label 10 belongs
  //     to EAT `eat_nonce` (RFC 9711 §4.1) and is NOT it.
  {
    domain: "accessTokenHash",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "3.1.3.6",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.3.1.3.6",
    },
    wire: labelled("at_hash", P(0)),
    // OIDC Core §3.1.3.6 — the domain value is the base64url digest, which IS the
    // JOSE wire form. ⚠ The COSE form is AEGIS POLICY: no registered CWT claim
    // standardises one, and carrying the b64url TEXT would spend 4 bytes per 3, so
    // aegis carries the decoded bytes.
    codec: { kind: "text", per: { cose: { kind: "bstr", encoding: "b64u" } } },
    sensitivity: "public",
    sample: "hAsHhAsHhAsHhAsHhAsHhA",
    bucket: "claims",
    // REFUSE: `at_hash` (OIDC Core §3.1.3.6) binds the ID Token to an access
    // token, and an empty digest is a binding no access token can match — pinned
    // by `scenarios.ts` "an-empty-access-token-hash-is-refused-before-it-is-signed".
    whenEmpty: "refuse",
    domainClaim: true,
  },
  {
    domain: "codeHash",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "3.3.2.11",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.3.3.2.11",
    },
    wire: labelled("c_hash", P(1)),
    // The `at_hash` codec argument, for the authorization code.
    codec: { kind: "text", per: { cose: { kind: "bstr", encoding: "b64u" } } },
    sensitivity: "public",
    sample: "hAsHhAsHhAsHhAsHhAsHhA",
    bucket: "claims",
    // REFUSE: `c_hash` (OIDC Core §3.3.2.11) binds the ID Token to an
    // authorization code, and an empty digest is a binding no code can match —
    // pinned by `scenarios.ts` "an-empty-code-hash-is-refused-before-it-is-signed".
    whenEmpty: "refuse",
    domainClaim: true,
  },
  {
    domain: "stateHash",
    spec: {
      kind: "oidc",
      doc: "FAPI 1.0 Part 2",
      section: "5.1.1",
      url: "https://openid.net/specs/openid-financial-api-part-2-1_0.html#rfc.section.5.1.1",
    },
    wire: labelled("s_hash", P(2)),
    // The `at_hash` codec argument, for the `state` value.
    codec: { kind: "text", per: { cose: { kind: "bstr", encoding: "b64u" } } },
    sensitivity: "public",
    sample: "hAsHhAsHhAsHhAsHhAsHhA",
    bucket: "claims",
    // REFUSE: `s_hash` (FAPI 1.0 Part 2 §5.1.1) binds the ID Token to the `state`
    // value, and an empty digest is a binding no `state` can match — pinned by
    // `scenarios.ts` "an-empty-state-hash-is-refused-before-it-is-signed".
    whenEmpty: "refuse",
    domainClaim: true,
  },
  {
    domain: "nonce",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "2",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.2",
    },
    wire: labelled("nonce", P(3)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "nonce_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "authTime",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "2",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.2",
    },
    wire: labelled("auth_time", P(4)),
    codec: { kind: "date" },
    sensitivity: "public",
    sample: SAMPLE_PAST_DATE,
    bucket: "claims",
    whenEmpty: "prune",
    temporal: "past",
    domainClaim: true,
  },
  // RFC 9396
  {
    domain: "authorizationDetails",
    spec: {
      kind: "rfc",
      rfc: "RFC 9396",
      section: "9.1",
      url: "https://www.rfc-editor.org/rfc/rfc9396#section-9.1",
    },
    wire: labelled("authorization_details", P(5)),
    // A COLLECTION of declared structures. `open: "verbatim"` is MANDATORY and not
    // a preference (RFC 9396 §2): the fields beside `type` belong to whoever
    // registered that type, so a case flip would rewrite rather than translate
    // them. See `authorization-details-members.ts`.
    codec: {
      kind: "array",
      of: {
        kind: "object",
        children: () => AUTHORIZATION_DETAIL_MEMBERS,
        open: "verbatim",
      },
    },
    sensitivity: "public",
    sample: AUTHORIZATION_DETAILS_SAMPLE,
    bucket: "claims",
    // KEEP: an empty RAR structure grants nothing where an absent one restricts
    // nothing (RFC 9396 §2) — the whole shape of the fail-open this column exists
    // to prevent.
    whenEmpty: "keep",
    domainClaim: true,
  },
  // RFC 8693
  {
    domain: "mayAct",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.4",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.4",
    },
    wire: labelled("may_act", P(6)),
    // ⚠ THE SAME member set OBJECT as `act` (RFC 8693 §4.1, RFC 8693 §4.4), not a copy:
    // two arrays would be two places a label could be written. The CLAIM key is
    // where the two genuinely differ — a private-use integer label here, a string
    // name there.
    codec: { kind: "object", children: () => ACT_MEMBERS, open: "verbatim" },
    sensitivity: "public",
    sample: ACT_SAMPLE,
    bucket: "claims",
    // REFUSE: `may_act` (RFC 8693 §4.4) authorises a party to become the actor,
    // and an object with no member authorises nobody a token endpoint could
    // recognise — pinned by `scenarios.ts`
    // "an-authorized-actor-that-identifies-nobody-is-refused-before-it-is-signed".
    whenEmpty: "refuse",
    domainClaim: true,
  },
  {
    domain: "entitlements",
    spec: {
      kind: "rfc",
      rfc: "RFC 9068",
      section: "2.2.3.1",
      url: "https://www.rfc-editor.org/rfc/rfc9068#section-2.2.3.1",
    },
    wire: labelled("entitlements", P(7)),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["entitlement_sample"],
    bucket: "claims",
    // PRUNE: the lindorm authority lists are the issuer's own vocabulary, and the
    // only issuer that mints them — tyr's access-token mint — emits an empty list
    // as absence, so keeping `[]` would change what tyr puts on the wire.
    // ⚠ THE COUNTER-ARGUMENT, on the record: `[]` can be read as "resolved, holds
    // none" where absence invites a consumer to look the authority up elsewhere.
    // Weighed and not taken — no consumer distinguishes the two.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "groups",
    spec: {
      kind: "rfc",
      rfc: "RFC 9068",
      section: "2.2.3.1",
      url: "https://www.rfc-editor.org/rfc/rfc9068#section-2.2.3.1",
    },
    wire: labelled("groups", P(8)),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["group_sample"],
    bucket: "claims",
    // PRUNE: the `entitlements` argument — a membership the issuer resolved is
    // still emitted as absence when it holds none.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "roles",
    spec: {
      kind: "rfc",
      rfc: "RFC 9068",
      section: "2.2.3.1",
      url: "https://www.rfc-editor.org/rfc/rfc9068#section-2.2.3.1",
    },
    wire: labelled("roles", P(9)),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["role_sample"],
    bucket: "claims",
    // PRUNE: the `entitlements` argument. The inert token stays legitimate — it
    // is expressed by the claim being absent, which is what tyr already emits.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "permissions",
    spec: {
      kind: "policy",
      why: "lindorm's authority list; the only `permissions` in any specification is a type-specific field inside an example RAR object.",
    },
    wire: labelled("permissions", P(10)),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["permission_sample"],
    bucket: "claims",
    // PRUNE: the `entitlements` argument.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "clientId",
    spec: {
      kind: "rfc",
      rfc: "RFC 8693",
      section: "4.3",
      url: "https://www.rfc-editor.org/rfc/rfc8693#section-4.3",
    },
    wire: labelled("client_id", P(11)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "client_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },

  // --- SET claims (RFC 8417 / RFC 9493). `subjectId` (RFC 9493) IS extracted by
  //     the floor (`domainClaim`); `events` is SET-token-specific and carries no
  //     mark, so the TOKEN read alone resolves it (a `TokenClaims` key).
  // RFC 9493
  {
    domain: "subjectId",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "4.1",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-4.1",
    },
    wire: labelled("sub_id", P(12)),
    // ⭐ THE ARRAY-OF-SELF STRUCTURE (RFC 9493 §3.2.8) — the only declared member
    // reaching the COLLECTION arm of every walker. `open: "verbatim"` because a
    // Subject Identifier's members are named by whoever registered its FORMAT; see
    // `internal/claims/sub-id-members.ts`.
    codec: { kind: "object", children: () => SUB_ID_MEMBERS, open: "verbatim" },
    sensitivity: "public",
    sample: SUB_ID_SAMPLE,
    bucket: "claims",
    // REFUSE: `sub_id` (RFC 9493 §4.1) identifies who the token is about, and an
    // identifier with no member identifies nobody a recipient could act on —
    // pinned by `scenarios.ts`
    // "a-subject-identifier-that-identifies-nobody-is-refused-before-it-is-signed".
    whenEmpty: "refuse",
    domainClaim: true,
  },
  // RFC 8417 SET events
  {
    domain: "events",
    spec: {
      kind: "rfc",
      rfc: "RFC 8417",
      section: "2.2",
      url: "https://www.rfc-editor.org/rfc/rfc8417#section-2.2",
    },
    wire: labelled("events", P(13)),
    codec: { kind: "bespoke", bespoke: "events" },
    sensitivity: "public",
    sample: { "https://schemas.lindorm.test/event/sample": {} },
    bucket: "claims",
    // REFUSE: `events` (RFC 8417 §2.2) is what makes the token a SET, and a map
    // naming no event type states no event a recipient could act on — pinned by
    // `scenarios.ts` "an-events-map-that-names-no-event-is-refused-before-it-is-signed".
    whenEmpty: "refuse",
  },

  {
    domain: "tenantId",
    spec: { kind: "policy", why: "lindorm's multi-tenancy identifier." },
    wire: labelled("tenant_id", P(14)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "tenant_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },

  // RS-facing posture signal: the profiles the token's issuing client clears
  // above the `permissive` floor.
  {
    domain: "conformsTo",
    spec: {
      kind: "policy",
      why: "lindorm's posture signal naming the profiles the issuing client clears above the permissive floor.",
    },
    wire: labelled("conforms_to", P(15)),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["strict"],
    bucket: "claims",
    // PRUNE: `permissive` is the floor every client clears, so "conforms to nothing
    // above the floor" states nothing a resource server can act on.
    whenEmpty: "prune",
    domainClaim: true,
  },

  // --- SENSITIVE identity claims (government-issued personal identifiers) ---
  //     The `AegisSensitive` set: national identity / social-security numbers and
  //     their OIDC Core §5.1-style verified flags. They travel FLAT on the wire;
  //     `sensitivity: "sensitive"` drives the aegis confidentiality gate — honoured
  //     ONLY on an encrypted token and suppressed otherwise
  //     (`internal/utils/extract-sensitive-claims.ts`).
  //     ⚠ They are `bucket: "claims"` because that is the only non-profile bucket;
  //     the set reaching the top-level claim pick is `bucket "claims" AND
  //     sensitivity "public"`, which is what `assemble-common-claims.ts` asks for.
  {
    domain: "nationalIdentityNumber",
    spec: {
      kind: "policy",
      why: "lindorm's national identity number; no specification registers this claim.",
    },
    wire: labelled("national_identity_number", P(16)),
    codec: { kind: "text" },
    sensitivity: "sensitive",
    sample: "19900101-1234",
    bucket: "claims",
    whenEmpty: "prune",
  },
  {
    domain: "nationalIdentityNumberVerified",
    spec: {
      kind: "policy",
      why: "lindorm's verification mark for the national identity number.",
    },
    wire: labelled("national_identity_number_verified", P(17)),
    codec: { kind: "bool" },
    sensitivity: "sensitive",
    sample: true,
    bucket: "claims",
    whenEmpty: "prune",
  },
  {
    domain: "socialSecurityNumber",
    spec: {
      kind: "policy",
      why: "lindorm's social security number; no specification registers this claim.",
    },
    wire: labelled("social_security_number", P(18)),
    codec: { kind: "text" },
    sensitivity: "sensitive",
    sample: "123-45-6789",
    bucket: "claims",
    whenEmpty: "prune",
  },
  {
    domain: "socialSecurityNumberVerified",
    spec: {
      kind: "policy",
      why: "lindorm's verification mark for the social security number.",
    },
    wire: labelled("social_security_number_verified", P(19)),
    codec: { kind: "bool" },
    sensitivity: "sensitive",
    sample: true,
    bucket: "claims",
    whenEmpty: "prune",
  },

  // --- OIDC Core §5.1 PROFILE claims (the `AegisProfile` set) ---
  //     `bucket: "profile"`, so read-side bucketing collects them into
  //     `VerifiedToken.profile`. The codec kind is DERIVED from the `AegisProfile`
  //     field type (string→text, boolean→bool, Date→date, Array<string>→array,
  //     nested object→bespoke); a NumericDate claim is a `Date` in the domain
  //     layer, never a raw number of seconds, which the `date` codec drops.
  //     ⚠ The claim NAMED `profile` is an OIDC Core §5.1 URL and is distinct from
  //     the `bucket: "profile"` group.
  {
    domain: "address",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("address", P(20)),
    // `open: "flip"` keeps an undeclared member on the wire under a snake_cased
    // key: an undeclared address member is a lindorm extension of a lindorm type,
    // so the house convention is the right one for it. See `address-members.ts`,
    // and `ObjectCodec` for why the tail policy is a cell rather than a constant.
    codec: { kind: "object", children: () => ADDRESS_MEMBERS, open: "flip" },
    sensitivity: "public",
    sample: ADDRESS_SAMPLE,
    bucket: "profile",
    // PRUNE: OIDC Core §5.1.1 defines `address` entirely by its members, and the
    // MEMBERS answer this question for themselves — differently. See
    // `ParamSpec.whenEmpty` for why the two levels diverge.
    whenEmpty: "prune",
  },
  {
    domain: "email",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("email", P(21)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "sample@lindorm.test",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "emailVerified",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("email_verified", P(22)),
    codec: { kind: "bool" },
    sensitivity: "public",
    sample: true,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "phoneNumber",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("phone_number", P(23)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "+46700000000",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "phoneNumberVerified",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("phone_number_verified", P(24)),
    codec: { kind: "bool" },
    sensitivity: "public",
    sample: true,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "picture",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("picture", P(25)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "https://cdn.lindorm.test/sample.png",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "birthdate",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("birthdate", P(26)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "1990-01-01",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "familyName",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("family_name", P(27)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Nordmann",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "gender",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("gender", P(28)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "other",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "givenName",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("given_name", P(29)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Sam",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "locale",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("locale", P(30)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "sv-SE",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "middleName",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("middle_name", P(31)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Lee",
    bucket: "profile",
    whenEmpty: "prune",
  },
  // 4 chars ⇒ string-keyed (the string key is the smaller CBOR encoding).
  {
    domain: "name",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: named("name"),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Sam Nordmann",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "nickname",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("nickname", P(32)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Sammy",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "preferredUsername",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("preferred_username", P(33)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "sam",
    bucket: "profile",
    whenEmpty: "prune",
  },
  // The CLAIM named `profile` — distinct from the bucket of the same name.
  {
    domain: "profile",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("profile", P(34)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "https://lindorm.test/sam",
    bucket: "profile",
    whenEmpty: "prune",
  },
  // ⚠ NOT temporal: a profile timestamp is never range-checked against "now".
  {
    domain: "updatedAt",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("updated_at", P(35)),
    codec: { kind: "date" },
    sensitivity: "public",
    sample: SAMPLE_PAST_DATE,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "website",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("website", P(36)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "https://lindorm.test",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "zoneinfo",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1",
    },
    wire: labelled("zoneinfo", P(37)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Europe/Stockholm",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "displayName",
    spec: {
      kind: "policy",
      why: "lindorm's display name; SCIM spells its nearest attribute `displayName`, a different wire name in a provisioning schema.",
    },
    wire: labelled("display_name", P(38)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Sam N",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "honorific",
    spec: {
      kind: "policy",
      why: "lindorm's honorific; SCIM carries `honorificPrefix`/`honorificSuffix` as `name` sub-attributes, not this claim.",
    },
    wire: labelled("honorific", P(39)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Dr",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "legalName",
    spec: {
      kind: "policy",
      why: "lindorm's registered legal name, distinct from the OIDC `name` claim.",
    },
    wire: labelled("legal_name", P(40)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Samuel Nordmann",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "legalNameVerified",
    spec: { kind: "policy", why: "lindorm's verification mark for the legal name." },
    wire: labelled("legal_name_verified", P(41)),
    codec: { kind: "bool" },
    sensitivity: "public",
    sample: true,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "namingSystem",
    spec: { kind: "policy", why: "lindorm's enum for how the name parts compose." },
    wire: labelled("naming_system", P(42)),
    codec: { kind: "text" },
    sensitivity: "public",
    // ⚠ THE SAMPLE MUST BE A MEMBER OF `AegisProfileNamingSystem`, AND NOTHING
    // CHECKS THAT. The column is typed `unknown` (`ParamSpec<D = unknown>`) and
    // the registry's sample test checks the CODEC kind (`text`), which any string
    // satisfies.
    sample: "given_family",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "preferredAccessibility",
    spec: { kind: "policy", why: "lindorm's accessibility-preference list." },
    wire: labelled("preferred_accessibility", P(43)),
    codec: { kind: "array", scalar: "strict" },
    sensitivity: "public",
    sample: ["high-contrast"],
    bucket: "profile",
    // PRUNE: a profile preference — "none stated" is what absence already says.
    whenEmpty: "prune",
  },
  {
    domain: "preferredName",
    spec: {
      kind: "policy",
      why: "lindorm's self-declared preferred name, distinct from `nickname` and `preferred_username`.",
    },
    wire: labelled("preferred_name", P(44)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Sam",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "pronouns",
    spec: { kind: "policy", why: "lindorm's self-declared pronouns." },
    wire: labelled("pronouns", P(45)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "they/them",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "department",
    spec: {
      kind: "policy",
      why: "lindorm's department; the identical SCIM name is an Enterprise User provisioning attribute, not a token claim.",
    },
    wire: labelled("department", P(46)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Engineering",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "jobTitle",
    spec: {
      kind: "policy",
      why: "lindorm's job title; SCIM spells the nearest concept `title`.",
    },
    wire: labelled("job_title", P(47)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Engineer",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "occupation",
    spec: {
      kind: "policy",
      why: "lindorm's occupation; no specification registers this claim.",
    },
    wire: labelled("occupation", P(48)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Engineer",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "organization",
    spec: {
      kind: "policy",
      why: "lindorm's organization; the identical SCIM name is an Enterprise User provisioning attribute, not a token claim.",
    },
    wire: labelled("organization", P(49)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "Lindorm",
    bucket: "profile",
    whenEmpty: "prune",
  },

  // --- RFC 7662 §2.2 `username`. A CLAIM about the token (bucket "claims",
  //     extracted like any other), NOT an OIDC Core §5.1 profile field — distinct
  //     from `preferred_username` above, and neither shadows the other. Appended
  //     here rather than beside the other OAuth claims because the private-use
  //     labels are APPEND-ONLY.
  {
    domain: "username",
    spec: {
      kind: "rfc",
      rfc: "RFC 7662",
      section: "2.2",
      url: "https://www.rfc-editor.org/rfc/rfc7662#section-2.2",
    },
    wire: labelled("username", P(50)),
    codec: { kind: "text" },
    sensitivity: "public",
    sample: "sam",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
];

/**
 * Which WIRE NAME a claim spec carries — the one parameter separating the JOSE and
 * COSE variants of everything that keys a dict by claim name: the translator
 * cores, and the identity-matcher builder.
 *
 * ⛔ IT LIVES HERE, not in `translate.ts`, because it is a REGISTRY fact. Any
 * consumer that hardcodes the JOSE name instead is wrong on a COSE-keyed wire —
 * an `assert: { tokenId }` would look for `jti` in a dict spelling it `cti`, so an
 * exact match rejects a legitimate token and `$exists: false` passes on a token
 * that HAS one.
 *
 * ⚠ IT TAKES THE IDENTITY COLUMNS, NOT A WHOLE `ClaimSpec`. A structured claim's
 * MEMBERS are spelled per wire exactly as the claim itself is, and the translator
 * walks into them carrying the same selector it entered the claim with — which is
 * what stops a member being named by one wire's rule inside a token keyed by the
 * other's. A selector demanding a full `ClaimSpec` could not be carried down.
 */
export type NameSelector = (spec: WireNamed) => string;

// Neither a claim nor a declared member is `absent` on either wire, and a registry
// test pins that. The narrowing is explicit rather than asserted, so the day one
// IS absent this throws at construction instead of putting `undefined` on a wire.
const requireName = (spec: WireNamed, wire: Wire): string => {
  const name = wireKeyName(spec.wire[wire]);

  if (name === undefined) {
    throw new Error(`Claim "${spec.domain}" has no ${wire} wire name`);
  }

  return name;
};

/** The JOSE wire name. Every claim rides JOSE, so this is always defined. */
export const joseName: NameSelector = (spec) => requireName(spec, "jose");

/** The COSE wire name — the diverging name where declared, else the JOSE one. */
export const coseName: NameSelector = (spec) => requireName(spec, "cose");

/** The COSE integer label, or `undefined` where the claim is string-keyed. */
export const coseLabel = (spec: ClaimSpec): number | undefined =>
  wireKeyLabel(spec.wire.cose);

const byDomain = new Map<string, ClaimSpec>(
  CLAIM_SPECS.map((spec) => [spec.domain, spec]),
);
const byJose = new Map<string, ClaimSpec>(
  CLAIM_SPECS.map((spec) => [joseName(spec), spec]),
);
// Integer COSE label -> spec. Only claims carrying an integer label are keyed.
const byCose = new Map<number, ClaimSpec>(
  CLAIM_SPECS.flatMap((spec) => {
    const label = coseLabel(spec);
    return label === undefined ? [] : [[label, spec] as const];
  }),
);
// COSE string name -> spec. The COSE name equals the JOSE name unless the registry
// declares a divergent one (RFC 8392 §3.1.7), so this keys every claim by its
// effective COSE string name.
const byCoseName = new Map<string, ClaimSpec>(
  CLAIM_SPECS.map((spec) => [coseName(spec), spec]),
);

/** Resolve a claim spec by its domain name (or `undefined` if not registered). */
export const claimByDomain = (domain: string): ClaimSpec | undefined =>
  byDomain.get(domain);

/** Resolve a claim spec by its JOSE wire name. */
export const claimByJose = (jose: string): ClaimSpec | undefined => byJose.get(jose);

/** Resolve a claim spec by its integer COSE label (or `undefined`). */
export const claimByCose = (cose: number): ClaimSpec | undefined => byCose.get(cose);

/**
 * Resolve a claim spec by its COSE string name — the diverging name where the
 * registry declares one (`cti`), else the JOSE name (`iss`, `exp`, …).
 */
export const claimByCoseName = (name: string): ClaimSpec | undefined =>
  byCoseName.get(name);

/**
 * The registry SUBSET carrying an optional mark, narrowed so the mark is REQUIRED
 * on each returned spec — the one canonical way to derive a mark-based claim set.
 * `claimsWith("temporal")` yields specs whose `temporal` is `"past" | "future"`
 * (never `undefined`), so a caller iterates type-safely with no null-check and an
 * exhaustive `switch` on the mark. Registry declaration order is preserved.
 */
export const claimsWith = <K extends keyof ClaimSpec>(
  mark: K,
): ReadonlyArray<ClaimSpec & Required<Pick<ClaimSpec, K>>> =>
  CLAIM_SPECS.filter(
    (spec): spec is ClaimSpec & Required<Pick<ClaimSpec, K>> => spec[mark] !== undefined,
  );
