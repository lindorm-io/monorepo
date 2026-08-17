/**
 * The single claim registry: the one place that maps each aegis DOMAIN claim to
 * its spelling on EVERY wire and to how its value is shaped.
 *
 * It is built on the shared {@link ParamSpec} base (`internal/registry/`), which
 * the header registry shares — a claim and a header parameter are the same kind
 * of thing (a named parameter with a wire spelling, a value shape, a provenance)
 * and used to be described by two unrelated types.
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
 *   - An N-character string key always encodes to N + 1 CBOR bytes.
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
 * --- Columns that are currently CONSTANT ---
 *
 * `direction` and `matchable` are the same for all 78 entries, and that is an
 * honest reading of the code rather than an omission: every registered claim
 * flows through the translator in BOTH directions (`domainToWire` /
 * `wireToDomain` iterate the same table), and `jwt-identity-matchers.ts` builds a
 * predicate for ANY key that resolves via `claimByDomain`, so every claim is
 * assertable. They are declared per entry anyway — the columns exist so a future
 * claim that is mint-only or non-assertable has somewhere to say so, and a
 * default would let it stay silent.
 */

import type { ClaimSpec } from "../registry/claim-spec.js";
import type { Directions, Registry } from "../registry/param-spec.js";
import type { Wire } from "../registry/wire.js";
import {
  type WireKey,
  wireKeyLabel,
  wireKeyName,
  wireLabel,
  wireName,
} from "../registry/wire-key.js";

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

/** Every claim flows in both directions — see the "constant columns" note above. */
const BOTH: Directions = ["mint", "verify"];

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
    wire: labelled("iss", 1),
    codec: { kind: "text" },
    provenance: "issuer",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "https://issuer.lindorm.test",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "subject",
    wire: labelled("sub", 2),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "subject_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "audience",
    // RFC 7519 aud is string-OR-array, so a scalar WRAPS to a single-element
    // array. That used to be a hardcoded `spec.domain === "audience"` branch in
    // the translator; it is data now.
    wire: labelled("aud", 3),
    codec: { kind: "array", scalar: "wrap" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("exp", 4),
    codec: { kind: "date" },
    provenance: "computed",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: SAMPLE_FUTURE_DATE,
    bucket: "claims",
    whenEmpty: "prune",
    temporal: "future",
    domainClaim: true,
  },
  {
    domain: "notBefore",
    wire: labelled("nbf", 5),
    codec: { kind: "date" },
    provenance: "computed",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: SAMPLE_PAST_DATE,
    bucket: "claims",
    whenEmpty: "prune",
    temporal: "past",
    domainClaim: true,
  },
  {
    domain: "issuedAt",
    wire: labelled("iat", 6),
    codec: { kind: "date" },
    provenance: "computed",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: SAMPLE_PAST_DATE,
    bucket: "claims",
    whenEmpty: "prune",
    temporal: "past",
    domainClaim: true,
  },
  // CWT cti (RFC 8392 label 7). The one genuine PER-WIRE codec: a text string on
  // JOSE, its raw UTF-8 bytes on COSE. That divergence used to be spelled as a
  // `bstr` value kind the JOSE translator silently treated as text.
  {
    domain: "tokenId",
    wire: labelled("jti", 7, "cti"),
    codec: { kind: "text", per: { cose: { kind: "bstr" } } },
    provenance: "computed",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "token_id_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // RFC 8747
  {
    domain: "confirmation",
    wire: labelled("cnf", 8),
    codec: { kind: "bespoke", bespoke: "confirmation" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    // The `keyId` member is the one confirmation form BOTH wires carry — a
    // thumbprint (`jkt`) has no COSE representation (RFC 9679 `ckt` hashes the
    // CBOR canonicalisation, so it is a different value, not a translation).
    sample: { keyId: "key_sample" },
    bucket: "claims",
    // KEEP: RFC 7800 `cnf` IS the proof-of-possession requirement. Pruning it hands
    // the audience a BEARER token; an empty one confirms no key and is refused.
    whenEmpty: "keep",
    domainClaim: true,
  },
  // RFC 8693
  {
    domain: "scope",
    wire: labelled("scope", 9),
    codec: { kind: "array", scalar: "spaced" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: named("acr"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "urn:lindorm:acr:mfa",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "authMethods",
    wire: named("amr"),
    codec: { kind: "array", scalar: "strict" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: named("azp"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "client_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "vectorOfTrust",
    wire: named("vot"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "P1.Cc.Cd",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "vectorTrustMark",
    wire: named("vtm"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "https://issuer.lindorm.test/vtm",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // RFC 8693
  {
    domain: "act",
    wire: named("act"),
    codec: { kind: "bespoke", bespoke: "act" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: { subject: "actor_sample" },
    bucket: "claims",
    // KEEP: RFC 8693 §4.1 `act` declares the token is wielded by an ACTOR on the
    // subject's behalf. Pruned, the delegation is invisible and the token reads as
    // the subject acting directly.
    whenEmpty: "keep",
    domainClaim: true,
  },
  {
    domain: "grantType",
    wire: named("gty"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "authorization_code",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // OIDC front-channel logout
  {
    domain: "sessionId",
    wire: named("sid"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "session_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // RFC 8417 txn — emitted but NOT extracted into DomainClaims (no domainClaim).
  {
    domain: "transactionId",
    wire: named("txn"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "txn_sample",
    bucket: "claims",
    whenEmpty: "prune",
  },
  // ISO/IEC 29115
  {
    domain: "levelOfAssurance",
    wire: named("loa"),
    codec: { kind: "int" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: 2,
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // NIST SP 800-63B
  {
    domain: "authenticatorAssuranceLevel",
    wire: named("aal"),
    codec: { kind: "int" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: 2,
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // NIST SP 800-63A
  {
    domain: "identityAssuranceLevel",
    wire: named("ial"),
    codec: { kind: "int" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: 2,
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // NIST SP 800-63C
  {
    domain: "federationAssuranceLevel",
    wire: named("fal"),
    codec: { kind: "int" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: named("afr"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "2fa",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  // PSD2 SCA categories (knowledge/possession/inherence) — the axes exercised.
  {
    domain: "authFactorCategories",
    wire: named("afc"),
    codec: { kind: "array", scalar: "strict" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: ["knowledge", "possession"],
    bucket: "claims",
    // PRUNE: the `amr` argument — a description of the factors used.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "sessionHint",
    wire: named("sih"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "session_hint_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "subjectHint",
    wire: named("suh"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("at_hash", P(0)),
    codec: { kind: "bespoke", bespoke: "hash" },
    provenance: "computed",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "hAsHhAsHhAsHhAsHhAsHhA",
    bucket: "claims",
    // KEEP: the OIDC Core §3.1.3.6 / §3.3.2.11 hashes BIND the id_token to another
    // artifact. Pruned, the token is unbound — the substitution surface; an empty
    // digest matches nothing and is refused, which is the safe direction. Provenance
    // is `computed`, so aegis's own mint cannot reach the cell: it states the
    // direction a caller-supplied one must fail in.
    whenEmpty: "keep",
    domainClaim: true,
  },
  {
    domain: "codeHash",
    wire: labelled("c_hash", P(1)),
    codec: { kind: "bespoke", bespoke: "hash" },
    provenance: "computed",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "hAsHhAsHhAsHhAsHhAsHhA",
    bucket: "claims",
    // KEEP: the `at_hash` binding argument, for the authorization code.
    whenEmpty: "keep",
    domainClaim: true,
  },
  {
    domain: "stateHash",
    wire: labelled("s_hash", P(2)),
    codec: { kind: "bespoke", bespoke: "hash" },
    provenance: "computed",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "hAsHhAsHhAsHhAsHhAsHhA",
    bucket: "claims",
    // KEEP: the `at_hash` binding argument, for the `state` value.
    whenEmpty: "keep",
    domainClaim: true,
  },
  {
    domain: "nonce",
    wire: labelled("nonce", P(3)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "nonce_sample",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "authTime",
    wire: labelled("auth_time", P(4)),
    codec: { kind: "date" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("authorization_details", P(5)),
    codec: { kind: "bespoke", bespoke: "authDetails" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: [{ type: "payment_initiation" }],
    bucket: "claims",
    // KEEP: RFC 9396 — an empty RAR structure grants nothing, an absent one restricts
    // nothing. This is the whole shape of the fail-open the column exists to prevent.
    whenEmpty: "keep",
    domainClaim: true,
  },
  // RFC 8693
  {
    domain: "mayAct",
    wire: labelled("may_act", P(6)),
    codec: { kind: "bespoke", bespoke: "act" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: { subject: "actor_sample" },
    bucket: "claims",
    // KEEP: RFC 8693 §4.4 names who may BECOME the actor — the delegation policy the
    // issuer wrote down. Symmetric with `act`, and stated by the same issuer.
    whenEmpty: "keep",
    domainClaim: true,
  },
  {
    domain: "entitlements",
    wire: labelled("entitlements", P(7)),
    codec: { kind: "array", scalar: "strict" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("groups", P(8)),
    codec: { kind: "array", scalar: "strict" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("roles", P(9)),
    codec: { kind: "array", scalar: "spaced" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("permissions", P(10)),
    codec: { kind: "array", scalar: "spaced" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: ["permission_sample"],
    bucket: "claims",
    // PRUNE: the `entitlements` argument.
    whenEmpty: "prune",
    domainClaim: true,
  },
  {
    domain: "clientId",
    wire: labelled("client_id", P(11)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("sub_id", P(12)),
    codec: { kind: "bespoke", bespoke: "subId" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: { format: "opaque", id: "subject_sample" },
    bucket: "claims",
    // KEEP: RFC 9493 identifies WHO an event is about. A SET whose `sub_id` was
    // pruned names no subject to act on.
    whenEmpty: "keep",
    domainClaim: true,
  },
  // RFC 8417 SET events
  {
    domain: "events",
    wire: labelled("events", P(13)),
    codec: { kind: "bespoke", bespoke: "events" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("tenant_id", P(14)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("conforms_to", P(15)),
    codec: { kind: "array", scalar: "spaced" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("national_identity_number", P(16)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "sensitive",
    sample: "19900101-1234",
    bucket: "claims",
    whenEmpty: "prune",
  },
  {
    domain: "nationalIdentityNumberVerified",
    wire: labelled("national_identity_number_verified", P(17)),
    codec: { kind: "bool" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "sensitive",
    sample: true,
    bucket: "claims",
    whenEmpty: "prune",
  },
  {
    domain: "socialSecurityNumber",
    wire: labelled("social_security_number", P(18)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "sensitive",
    sample: "123-45-6789",
    bucket: "claims",
    whenEmpty: "prune",
  },
  {
    domain: "socialSecurityNumberVerified",
    wire: labelled("social_security_number_verified", P(19)),
    codec: { kind: "bool" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("address", P(20)),
    codec: { kind: "bespoke", bespoke: "address" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: { streetAddress: "Sample 1", postalCode: "00100", country: "SE" },
    bucket: "profile",
    // PRUNE: OIDC Core §5.1.1 defines `address` entirely by its members.
    whenEmpty: "prune",
  },
  {
    domain: "email",
    wire: labelled("email", P(21)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "sample@lindorm.test",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "emailVerified",
    wire: labelled("email_verified", P(22)),
    codec: { kind: "bool" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: true,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "phoneNumber",
    wire: labelled("phone_number", P(23)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "+46700000000",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "phoneNumberVerified",
    wire: labelled("phone_number_verified", P(24)),
    codec: { kind: "bool" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: true,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "picture",
    wire: labelled("picture", P(25)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "https://cdn.lindorm.test/sample.png",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "birthdate",
    wire: labelled("birthdate", P(26)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "1990-01-01",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "familyName",
    wire: labelled("family_name", P(27)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Nordmann",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "gender",
    wire: labelled("gender", P(28)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "other",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "givenName",
    wire: labelled("given_name", P(29)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Sam",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "locale",
    wire: labelled("locale", P(30)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "sv-SE",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "middleName",
    wire: labelled("middle_name", P(31)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Lee",
    bucket: "profile",
    whenEmpty: "prune",
  },
  // "name" is 4 chars ⇒ string-keyed (the string key is the smaller CBOR encoding).
  {
    domain: "name",
    wire: named("name"),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Sam Nordmann",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "nickname",
    wire: labelled("nickname", P(32)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Sammy",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "preferredUsername",
    wire: labelled("preferred_username", P(33)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "sam",
    bucket: "profile",
    whenEmpty: "prune",
  },
  // OIDC `profile` URL claim — the CLAIM named "profile" (distinct from the bucket).
  {
    domain: "profile",
    wire: labelled("profile", P(34)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("updated_at", P(35)),
    codec: { kind: "date" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: SAMPLE_PAST_DATE,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "website",
    wire: labelled("website", P(36)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "https://lindorm.test",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "zoneinfo",
    wire: labelled("zoneinfo", P(37)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Europe/Stockholm",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "displayName",
    wire: labelled("display_name", P(38)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Sam N",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "honorific",
    wire: labelled("honorific", P(39)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Dr",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "legalName",
    wire: labelled("legal_name", P(40)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Samuel Nordmann",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "legalNameVerified",
    wire: labelled("legal_name_verified", P(41)),
    codec: { kind: "bool" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: true,
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "namingSystem",
    wire: labelled("naming_system", P(42)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("preferred_accessibility", P(43)),
    codec: { kind: "array", scalar: "strict" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: ["high-contrast"],
    bucket: "profile",
    // PRUNE: a profile preference — "none stated" is what absence already says.
    whenEmpty: "prune",
  },
  {
    domain: "preferredName",
    wire: labelled("preferred_name", P(44)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Sam",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "pronouns",
    wire: labelled("pronouns", P(45)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "they/them",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "department",
    wire: labelled("department", P(46)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Engineering",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "jobTitle",
    wire: labelled("job_title", P(47)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Engineer",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "occupation",
    wire: labelled("occupation", P(48)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "Engineer",
    bucket: "profile",
    whenEmpty: "prune",
  },
  {
    domain: "organization",
    wire: labelled("organization", P(49)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
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
    wire: labelled("username", P(50)),
    codec: { kind: "text" },
    provenance: "caller",
    direction: BOTH,
    matchable: true,
    sensitivity: "public",
    sample: "sam",
    bucket: "claims",
    whenEmpty: "prune",
    domainClaim: true,
  },
];

/**
 * The claim registry. `unregistered: "passthrough"` states ONCE what makes the
 * claim side different from the header side: claims are an OPEN set, so a key
 * with no entry is a CUSTOM claim carried through (case-flipped, value
 * untouched), never dropped.
 */
export const CLAIMS_REGISTRY: Registry<ClaimSpec> = {
  specs: CLAIM_SPECS,
  unregistered: "passthrough",
};

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
 */
export type NameSelector = (spec: ClaimSpec) => string;

// No claim is `absent` on either wire (a claim that cannot ride a wire has never
// existed here), and a registry test pins that. The narrowing is still explicit
// rather than asserted, so the day one IS absent this throws at construction
// instead of putting `undefined` on a wire.
const requireName = (spec: ClaimSpec, wire: Wire): string => {
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
