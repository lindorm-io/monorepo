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
