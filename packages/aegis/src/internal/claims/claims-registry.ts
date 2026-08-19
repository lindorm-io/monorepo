/**
 * The single claim registry: the one place that maps each aegis DOMAIN claim to
 * its spelling on EVERY wire and to how its value is shaped.
 *
 * It is built on the shared {@link ParamSpec} base (`internal/registry/`), which
 * the header registry shares — a claim and a header parameter are the same kind
 * of thing (a named parameter with a wire spelling, a value shape and an
 * emptiness verdict) and used to be described by two unrelated types.
 *
 * Both encoders consume this — the JOSE encoder maps `domain → wire.jose`, the
 * COSE encoder `domain → wire.cose`. Keeping it in one table is the anti-drift
 * mechanism: a claim is defined exactly once.
 *
 * Provenance: the registry is the SOURCE OF TRUTH for the `domain ↔ jose` set.
 * The `domainClaim` marks below ARE the `DomainClaims` set — what the verify-floor
 * read resolves — and a drift-guard test freezes those names and binds them to the
 * `DomainClaims` type in both directions.
 *
 * --- The COSE map-key rule (byte-size minimisation) ---
 *
 * `wire.cose` decides the CBOR map key for a claim, governed by one rule: pick
 * whichever key is smaller on the wire.
 *   - A private-use integer label (`< -65536`) always encodes to 5 CBOR bytes.
 *   - An N-character string key encodes to N + 1 CBOR bytes for N < 24, and
 *     N + 2 above that (CBOR switches to a 2-byte head at 24).
 * So the integer wins only when it saves bytes — i.e. when the JOSE name is
 * 5 characters or longer (≥ 6 string bytes). For names of 4 characters or
 * fewer the string is the same size or smaller, so the claim stays string-keyed.
 *
 * The three cases for `wire.cose`:
 *   (a) a registered integer label (RFC 8392 / IANA CWT registry, 1–9): always
 *       that integer — untouched by the byte-size rule;
 *   (b) `wireName(...)` ⇒ no registered integer label AND a short JOSE name
 *       (≤ 4 chars, e.g. acr/amr/loa/aal): the JOSE string name is the CBOR map
 *       key, on- and off-platform (interoperable; a stock verifier reads it);
 *   (c) a private-use integer label (`< -65536`, via `P(n)`) ⇒ no registered
 *       integer label but a long JOSE name (≥ 5 chars): the compact integer
 *       label is used on-platform; off-platform (mint option `proprietary:
 *       false`) it degrades to the WireKey's `name` (see cwt-claims.ts). Such a
 *       claim is NEVER dropped from a token.
 *
 * No claim is `absent` on either wire — every claim rides both. The `absent`
 * arm of {@link WireKey} is exercised by the header registry.
 *
 * --- The empty-value column ---
 *
 * `whenEmpty` is REQUIRED on every entry ({@link ClaimSpec.whenEmpty}) and has no
 * default, because both answers fail open in a different direction: a blanket
 * keep fabricates assertions the issuer never made (`amr: []` reads as "the
 * methods are known and none applied"), and a blanket prune strips restrictions
 * (RFC 9396 `actions: []` grants no action, while an ABSENT `actions` is not
 * restricted by action at all). 78 cells, each a decision; the ones a reader
 * would question carry their reason inline. The 11 `"keep"` cells are the
 * restrictions (`aud`, RAR), the bindings (`cnf`, the OIDC hashes), the
 * delegation pair, and the two SET claims that ARE the token — everything else
 * prunes, the four lindorm authority lists (`roles`/`permissions`/
 * `entitlements`/`groups`) among them. `scope` KEEPS and splits from those four
 * on purpose — see its entry, where the reasoning is stated as AEGIS POLICY: no
 * specification defines the absence of either, so the differentiator is that the
 * four are our own vocabulary whose sole issuer already emits empty as absence,
 * while `scope` is only a SHOULD (RFC 9068 §2.2.3) and an explicit empty list is
 * therefore the one way an issuer can say "this grant conveys nothing".
 *
 * ⚠ A `"keep"` cell is the ONLY way an empty value reaches the wire, so its
 * empty form must be REFUSABLE BY POLICY — a profile that cannot tolerate it
 * names the claim in a `required` rule (`isClaimSatisfied` treats `[]`/`{}`/`""`
 * as nothing to bite on) or in a `shape` rule. The registry deliberately does
 * not decide that: whether an `aud: []` is acceptable is a fact about the TOKEN,
 * not about the claim, and `whenEmpty` answers per claim. What the registry owes
 * is that the value survives to where the profile can see it, which is what
 * `"keep"` means.
 *
 * --- What this registry does NOT declare ---
 *
 * `direction`, `matchable` and `provenance` were three columns here, 78 cells
 * each, and NOTHING read any of them. Each was constant or near-constant, so a
 * cell restated the registry it sat in rather than describing its entry, and the
 * question each claimed to answer is already asked in code: the translator
 * iterates the same table in both directions (`domainToWire` / `wireToDomain`),
 * `jwt-identity-matchers.ts` builds a predicate for ANY key resolving via
 * `claimByDomain`, and "is there a caller door, and which one?" is executed by
 * `__fixtures__/spec-dispositions.ts` rather than remembered. A column that
 * answers a question the code is already asking is load-bearing; one invented to
 * look complete is a second source of truth waiting to disagree.
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

// First private-use COSE label is the first integer below the -65536 boundary.
// Claims with no registered CWT label but a long JOSE name (≥ 5 chars) get a
// stable, sequential label here so they encode to 5 bytes instead of name+1.
// These are meaningful only to a verifier holding this registry; off-platform
// they degrade to their JOSE string key (never dropped).
const P = (n: number): number => -65537 - n;

// --- entry shorthands --------------------------------------------------------

/** JOSE name; string-keyed on COSE under the same name (the byte-size rule). */
const named = (jose: string): Record<Wire, WireKey> => ({
  jose: wireName(jose),
  cose: wireName(jose),
});

/**
 * JOSE name + COSE integer label. `cose` is the COSE STRING name, which differs
 * from the JOSE name only where RFC 8392 renamed the claim (`jti` → `cti`); it is
 * both the off-platform degraded key and the vocabulary `domainToCose` speaks.
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
 * (`jwt-temporal-matchers.ts`), so a single instant given to both makes at least
 * one of them unverifiable at any clock — and it did: every `date` claim carried
 * the SAME 2026 instant, so `iat`/`nbf`/`auth_time` samples were two years ahead
 * of any plausible verification and refused on sight, while `exp` passed. A
 * consumer of these samples has to be able to build a token that VERIFIES, or the
 * column proves nothing.
 *
 * `updatedAt` is a `date` with NO temporal mark — a profile timestamp, never
 * range-checked — and takes the past sample because that is the honest shape of
 * "when this profile was last updated".
 */
const SAMPLE_PAST_DATE = new Date("2023-12-31T00:00:00.000Z");
const SAMPLE_FUTURE_DATE = new Date("2026-01-01T00:00:00.000Z");

/**
 * The registry. Order groups by COSE-key category for readability; lookups are
 * by the derived maps below, not by position.
 */
export const CLAIM_SPECS: ReadonlyArray<ClaimSpec> = [
  // --- (a) RFC 8392 standard CWT claims (registered integer labels 1–9) ---
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
    // RFC 7519 aud is string-OR-array, so a scalar WRAPS to a single-element
    // array. That used to be a hardcoded `spec.domain === "audience"` branch in
    // the translator; it is data now.
    wire: labelled("aud", 3),
    codec: { kind: "array", scalar: "wrap" },
    sensitivity: "public",
    sample: ["https://api.lindorm.test"],
    bucket: "claims",
    // KEEP: `aud: []` names NOBODY, and RFC 7519 §4.1.3 makes `aud` the audience
    // RESTRICTION — an absent one restricts nothing, so pruning turns the narrowest
    // statement the issuer can make into the widest.
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
  // CWT cti (RFC 8392 label 7). A PER-WIRE codec: a text string on JOSE, its raw
  // UTF-8 bytes on COSE. That divergence used to be spelled as a `bstr` value
  // kind the JOSE translator silently treated as text. The `encoding` says WHICH
  // bytes — `cti` is the token id's own UTF-8 (RFC 8392 §3.1.7), not a decode of
  // some alphabet, and the three OIDC hashes take the other answer.
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
    // The `keyId` member is the one confirmation form BOTH wires carry — a
    // thumbprint (`jkt`) has no COSE representation (RFC 9679 `ckt` hashes the
    // CBOR canonicalisation, so it is a different value, not a translation).
    sample: { keyId: "key_sample" },
    bucket: "claims",
    // KEEP: RFC 7800 `cnf` IS the proof-of-possession requirement. Pruning it hands
    // the audience a BEARER token; an empty one confirms no key and is refused.
    // ⚠ THE SECOND HALF OF THAT SENTENCE WAS FALSE FOR AS LONG AS IT STOOD HERE.
    // The write side collapsed an all-empty confirmation to `undefined`, so the
    // claim was DROPPED and the token minted as a plain bearer — a caller who
    // asked for a binding silently got none. It is refused now, by the translator
    // on the way out and by the verify policy gate on the way in
    // (`internal/claims/translate.ts`, `internal/utils/apply-verify-policy.ts`).
    whenEmpty: "keep",
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
    // KEEP. ⚠ THIS IS AEGIS POLICY, NOT A CITATION — and the reasoning matters,
    // because an earlier version of this comment justified it with RFC 6749 §3.3
    // and that was WRONG. §3.3 governs the AUTHORIZATION SERVER handling a CLIENT
    // REQUEST that omits `scope` ("the authorization server MUST either process
    // the request using a pre-defined default value or fail the request"); it says
    // nothing about a recipient reading an absent scope CLAIM, and the server that
    // could default has finished its work before this claim exists.
    //
    // The policy: RFC 9068 §2.2.3 makes `scope` only a SHOULD on an access token,
    // so a verifier cannot tell an absent `scope` from a grant that never had one.
    // That is exactly what gives an EXPLICIT empty list something to say — "this
    // grant conveys nothing" — and pruning it would erase the one statement the
    // ambiguity leaves an issuer able to make.
    //
    // ⚠ The four lindorm authority lists beside this one
    // (`roles`/`permissions`/`entitlements`/`groups`) PRUNE, and the honest
    // differentiator is NOT "spec-governed vs ours" — no specification defines the
    // absence of either. It is that those four are our own vocabulary whose sole
    // issuer already emits an empty list as absence
    // (`services/tyr/src/features/tokens/utils/mint-access-token.ts:10-17`).
    // A sixth list lands on "prune" by that rule.
    whenEmpty: "keep",
    domainClaim: true,
  },

  // --- (b) No registered integer label AND a short JOSE name (≤ 4 chars):
  //     string-keyed in CBOR (interoperable; the string key is the smaller
  //     encoding). Includes the standards-based assurance levels
  //     (ISO/IEC 29115 / NIST SP 800-63A/B/C) and the short lindorm hints.
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
    // PRUNE: a DESCRIPTION of how the subject authenticated, not a restriction on
    // anything — `amr: []` asserts "the methods are known and none applied", which no
    // issuer means and no audience can act on.
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
    // A DECLARED, RECURSIVE and OPEN member set — see `act-members.ts` for the
    // labels and for the RFC 8693 §4.1/§4.4 sentences that make it open. The
    // nested `act` member names ACT_MEMBERS itself, which is what the `children`
    // thunk exists for. `"verbatim"` and not `"flip"`: a tail member is another
    // specification's JWT claim name (§4.4 offers `email`), so the house
    // snake_case flip would not translate it but rewrite it.
    codec: { kind: "object", children: () => ACT_MEMBERS, open: "verbatim" },
    sensitivity: "public",
    sample: ACT_SAMPLE,
    bucket: "claims",
    // KEEP: RFC 8693 §4.1 `act` declares the token is wielded by an ACTOR on the
    // subject's behalf. Pruned, the delegation is invisible and the token reads as
    // the subject acting directly.
    whenEmpty: "keep",
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
  // RFC 8417 txn — emitted but NOT extracted into DomainClaims (no domainClaim).
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
      why: "lindorm's single resolved auth-factor value; RFC 8176 governs `amr` values, not this name.",
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
  //     Compact integer on-platform; degrades to the JOSE string key
  //     off-platform (proprietary:false) — NEVER dropped.
  // OIDC `nonce` is NOT CWT label 10 (that is EAT `eat_nonce`, RFC 9711); it is
  // a request-binding text string with no registered CWT label.
  {
    domain: "accessTokenHash",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "3.1.3.6",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.3.1.3.6",
    },
    wire: labelled("at_hash", P(0)),
    // OIDC Core §3.1.3.6: the domain value is the base64url left-half digest. On
    // JOSE that string IS the wire form; on COSE the bytes it decodes to are.
    // ⚠ AEGIS POLICY, not a spec requirement: the OIDC hashes have NO registered
    // CWT claim, so they ride private-use labels and nobody standardised a byte
    // form. COSE is binary-native, and carrying the b64url TEXT would spend 4
    // bytes per 3, so aegis carries the decoded bytes.
    codec: { kind: "text", per: { cose: { kind: "bstr", encoding: "b64u" } } },
    sensitivity: "public",
    sample: "hAsHhAsHhAsHhAsHhAsHhA",
    bucket: "claims",
    // KEEP: the OIDC Core §3.1.3.6 / §3.3.2.11 hashes BIND the id_token to another
    // artifact. Pruned, the token is unbound — the substitution surface; an empty
    // digest matches nothing and is refused, which is the safe direction. Aegis's
    // own mint cannot reach the cell — `assemble-common-claims.ts` derives the
    // digest or omits the claim — so it states the direction a caller-supplied one
    // must fail in.
    whenEmpty: "keep",
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
    // KEEP: the `at_hash` binding argument, for the authorization code.
    whenEmpty: "keep",
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
    // KEEP: the `at_hash` binding argument, for the `state` value.
    whenEmpty: "keep",
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
    // A COLLECTION of declared structures. `open: "verbatim"` is MANDATORY here
    // and not a preference: RFC 9396 §2 makes an element's `type` determine that
    // element's allowable contents, so the fields beside it belong to whoever
    // registered the type and a case flip would rewrite rather than translate
    // them. See `authorization-details-members.ts` for why `type` is the only
    // declared member.
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
    // KEEP: RFC 9396 — an empty RAR structure grants nothing, an absent one restricts
    // nothing. This is the whole shape of the fail-open the column exists to prevent.
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
    // RFC 8693 §4.4 describes `may_act` in the same words §4.1 uses for `act` —
    // "The claim value is a JSON object, and members in the JSON object are
    // claims that identify the party that is asserted as being eligible to act
    // for the party identified by the JWT containing the claim." — so it declares
    // the SAME member set object, not a copy of it. Two arrays would be two
    // places a label could be written, and the CLAIM key is where the two
    // genuinely differ (a private-use integer label here, a string name there).
    codec: { kind: "object", children: () => ACT_MEMBERS, open: "verbatim" },
    sensitivity: "public",
    sample: ACT_SAMPLE,
    bucket: "claims",
    // KEEP: RFC 8693 §4.4 names who may BECOME the actor — the delegation policy the
    // issuer wrote down. Symmetric with `act`, and stated by the same issuer.
    whenEmpty: "keep",
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
    // only issuer that mints them emits an empty list as absence
    // (`services/tyr/src/features/tokens/utils/mint-access-token.ts:10-17`), so
    // keeping `[]` would change what tyr puts on the wire today.
    // ⚠ THE COUNTER-ARGUMENT, on the record: `[]` can be read as "resolved, holds
    // none" where absence invites a consumer to look the authority up elsewhere.
    // That reading was weighed and not taken — no consumer distinguishes the two,
    // and the sole issuer's stated intent is absence.
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
    codec: { kind: "array", scalar: "spaced" },
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
    codec: { kind: "array", scalar: "spaced" },
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

  // --- SET claims (RFC 8417 / RFC 9493). `subjectId` (RFC 9493) IS extracted
  //     (`domainClaim`); `events` is SET-token-specific and NOT extracted, so it
  //     carries no mark.
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
    // ⭐ THE ARRAY-OF-SELF STRUCTURE. `identifiers` recurses as an array of
    // Subject Identifiers (RFC 9493 §3.2.8), which is the first declared member
    // to reach the COLLECTION arm of every walker. `open: "verbatim"` because a
    // Subject Identifier's members are named by whoever registered its FORMAT —
    // see `internal/claims/sub-id-members.ts`.
    codec: { kind: "object", children: () => SUB_ID_MEMBERS, open: "verbatim" },
    sensitivity: "public",
    sample: SUB_ID_SAMPLE,
    bucket: "claims",
    // KEEP: RFC 9493 identifies WHO an event is about. A SET whose `sub_id` was
    // pruned names no subject to act on.
    whenEmpty: "keep",
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
    // KEEP: RFC 8417 §2.2 — a member's PRESENCE is the statement, and OIDC
    // Back-Channel Logout §2.4 makes the empty object the normal payload. Pruning
    // deletes the event itself from a token whose profile REQUIRES it.
    whenEmpty: "keep",
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
  // above the `permissive` floor. Long JOSE name, no registered CWT label ⇒
  // private-use label (append-only: never renumber).
  {
    domain: "conformsTo",
    spec: {
      kind: "policy",
      why: "lindorm's posture signal naming the profiles the issuing client clears above the permissive floor.",
    },
    wire: labelled("conforms_to", P(15)),
    codec: { kind: "array", scalar: "spaced" },
    sensitivity: "public",
    sample: ["strict"],
    bucket: "claims",
    // PRUNE: `permissive` is the floor every client clears, so "conforms to nothing
    // above the floor" states nothing a resource server can act on.
    whenEmpty: "prune",
    domainClaim: true,
  },

  // --- SENSITIVE identity claims (government-issued personal identifiers) ---
  //     The `AegisSensitive` set: national identity / social-security numbers
  //     and their OIDC §5.1 verified flags. They travel FLAT on the wire;
  //     `sensitivity: "sensitive"` drives the aegis confidentiality gate — they are
  //     honoured ONLY on an encrypted token (jwe/cwe) and suppressed otherwise
  //     (extract-sensitive-claims.ts). Long JOSE names ⇒ private-use labels
  //     (append-only).
  //     ⚠ They are `bucket: "claims"` because that is the only non-profile
  //     bucket; the set that reaches the top-level claim pick is
  //     `bucket "claims" AND sensitivity "public"`, which is what
  //     assemble-common-claims.ts asks for.
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

  // --- OIDC §5.1 PROFILE claims (the `AegisProfile` set) ---
  //     Personalization / contact-card fields, `bucket: "profile"` so read-side
  //     bucketing collects them into `VerifiedToken.profile`. The codec kind is
  //     DERIVED from the AegisProfile field type (string→text, boolean→bool,
  //     Date→date, Array<string>→array, nested object→bespoke). A NumericDate
  //     claim is a `Date` in the domain layer — never a raw number of seconds,
  //     which the `date` codec drops. Long JOSE names ⇒ private-use labels
  //     (append-only after P(19)); the 4-char `name` stays string-keyed per the
  //     byte-rule. NOTE: the OIDC `profile` URL claim registers under
  //     domain/jose "profile"; that is the CLAIM name and is distinct from the
  //     `bucket: "profile"` group.
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
    // key, which is what the blanket case flip this replaced did for every key
    // alike — an undeclared address member is a lindorm extension of a lindorm
    // type, so the house convention is the right one for it. See
    // `address-members.ts` for what the declaration buys, and `ObjectCodec` for
    // why no set is closed yet and why the tail policy is a cell rather than a
    // constant.
    codec: { kind: "object", children: () => ADDRESS_MEMBERS, open: "flip" },
    sensitivity: "public",
    sample: ADDRESS_SAMPLE,
    bucket: "profile",
    // PRUNE: OIDC Core §5.1.1 defines `address` entirely by its members. The
    // MEMBERS answer the same question for themselves, and they answer it
    // differently — see `ParamSpec.whenEmpty` for why the two levels diverge.
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
  // "name" is 4 chars ⇒ string-keyed (the string key is the smaller CBOR encoding).
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
  // OIDC `profile` URL claim — the CLAIM named "profile" (distinct from the bucket).
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
  // `updatedAt` is an OIDC Core §5.1 NumericDate: domain `Date` <-> wire unix
  // seconds ⇒ "date", per the derive-from-type rule. It is NOT temporal — a
  // profile timestamp is never range-checked against "now".
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
    // The sample MUST be a member of `AegisProfileNamingSystem`. It was
    // `"western"`, which the union has never contained — the column is typed
    // `unknown` (`ParamSpec<D = unknown>`), so nothing rejected it, and the
    // registry's own sample test checks the CODEC kind (`text`) rather than the
    // domain type, which a bogus string satisfies.
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
  //     extracted like any other), NOT an OIDC §5.1 profile field — it is
  //     distinct from `preferred_username` above and neither shadows the other.
  //     Appended here rather than beside the other OAuth claims because the
  //     private-use labels are APPEND-ONLY: renumbering P(7)… to keep the
  //     declaration order pretty would silently reinterpret every CWT already
  //     issued. Long JOSE name (8 chars) ⇒ private-use label.
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
 * Which WIRE NAME a claim spec carries — the one parameter that separates the
 * JOSE and COSE variants of everything that keys a dict by claim name: the
 * translator cores, and the identity-matcher builder.
 *
 * It lives HERE, beside the registry that owns the divergence, because it is a
 * registry fact rather than a translator one. It was previously private to
 * `translate.ts`, and the matcher builder — which keys a predicate the same way —
 * hardcoded the JOSE name instead. That predicate was then applied to a
 * COSE-keyed wire, so an `assert: { tokenId }` looked for `jti` in a dict that
 * spells it `cti`: an exact match rejected a legitimate token, and
 * `$exists: false` passed on a token that HAS one.
 *
 * ⚠ IT TAKES THE IDENTITY COLUMNS, NOT A WHOLE `ClaimSpec`. A structured claim's
 * MEMBERS are spelled per wire exactly as the claim itself is, and the
 * translator walks into them carrying the same selector it entered the claim
 * with — which is what stops a member from being named by one wire's rule inside
 * a token keyed by the other's. A selector that demanded a full `ClaimSpec`
 * could not be carried down, and member naming would have become a second rule
 * written somewhere else.
 */
export type NameSelector = (spec: WireNamed) => string;

// Neither a claim nor a declared member is `absent` on either wire (a claim that
// cannot ride a wire has never existed here), and a registry test pins that. The
// narrowing is still explicit rather than asserted, so the day one IS absent this
// throws at construction instead of putting `undefined` on a wire.
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
// Integer COSE label -> spec. Only claims carrying an integer label (registered
// or private-use) are keyed; string-keyed claims are absent.
const byCose = new Map<number, ClaimSpec>(
  CLAIM_SPECS.flatMap((spec) => {
    const label = coseLabel(spec);
    return label === undefined ? [] : [[label, spec] as const];
  }),
);
// COSE string name -> spec. The COSE name equals the JOSE name unless the
// registry declares a divergent one (RFC 8392 `jti` -> `cti`), so this keys
// every claim by its effective COSE string name.
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
