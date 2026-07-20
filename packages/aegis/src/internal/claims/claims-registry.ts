/**
 * The single claim registry: the one place that maps each aegis DOMAIN claim
 * to its JOSE wire name, its COSE/CWT label, and how its value is encoded.
 *
 * Both encoders consume this — the JOSE encoder maps `domain → jose`, the COSE
 * encoder maps `domain → cose`. Keeping it in one table is the anti-drift
 * mechanism: a claim is defined exactly once.
 *
 * Provenance: the registry is the SOURCE OF TRUTH for the `domain ↔ jose` set —
 * `extract-claims.ts` derives its `FIELD_KEYS`/`RFC8693_KEYS`/`POP_KEYS` from the
 * `subset` marks below, and a drift-guard test freezes the old lists and asserts
 * the derived sets still equal them.
 *
 * --- The COSE map-key rule (byte-size minimisation) ---
 *
 * The `cose` field decides the CBOR map key for a claim, governed by one rule:
 * pick whichever key is smaller on the wire.
 *   - A private-use integer label (`< -65536`) always encodes to 5 CBOR bytes.
 *   - An N-character string key always encodes to N + 1 CBOR bytes.
 * So the integer wins only when it saves bytes — i.e. when the JOSE name is
 * 5 characters or longer (≥ 6 string bytes). For names of 4 characters or
 * fewer the string is the same size or smaller, so the claim stays string-keyed.
 *
 * The three cases for `cose`:
 *   (a) a registered integer label (RFC 8392 / IANA CWT registry, 1–9): always
 *       that integer — untouched by the byte-size rule;
 *   (b) `cose: null` ⇒ no registered integer label AND a short JOSE name
 *       (≤ 4 chars, e.g. acr/amr/loa/aal): the JOSE string name is the CBOR map
 *       key, on- and off-platform (interoperable; a stock verifier reads it);
 *   (c) a private-use integer label (`< -65536`, via `P(n)`) ⇒ no registered
 *       integer label but a long JOSE name (≥ 5 chars): the compact integer
 *       label is used on-platform; off-platform (mint option `proprietary:
 *       false`) it degrades to its JOSE string key (see cwt-claims.ts). Such a
 *       claim is NEVER dropped from a token.
 */

/** How a claim's VALUE is encoded on each wire. */
export type ClaimValueKind =
  | "text" // string scalar (iss, sub, acr…)
  | "int" // plain number, no transform (loa…)
  | "date" // NumericDate: domain Date <-> wire/COSE Unix-seconds int (exp, iat, nbf, auth_time)
  | "bool" // boolean scalar (national_identity_number_verified…)
  | "array" // array of strings (aud, scope, roles…)
  | "bstr" // byte string on the COSE wire (cti…)
  | "bespoke"; // needs a per-claim builder (cnf, hashes, act, sub_id, events…)

/**
 * Sub-kind of a `value: "bespoke"` claim — the discriminator that tells the
 * translator (encode/decode) and the COSE byte-shaper WHICH per-claim builder a
 * bespoke claim uses. Present EXACTLY on `value: "bespoke"` entries (a drift
 * guard asserts the iff). Claims sharing a builder share a sub-kind:
 *   - `"hash"`         the OIDC hashes (`at_hash`/`c_hash`/`s_hash`): a b64url
 *                      string on JOSE, a COSE byte string.
 *   - `"confirmation"` RFC 7800 `cnf` (proof-of-possession key).
 *   - `"act"`          RFC 8693 delegation `act`/`may_act` (recursive actor).
 *   - `"subId"`        RFC 9493 `sub_id` subject identifier.
 *   - `"events"`       RFC 8417 SET `events` map (carried verbatim).
 *   - `"authDetails"`  RFC 9396 `authorization_details` array (carried verbatim).
 *   - `"address"`      OIDC §5.1 `address` (nested object; snake its inner keys).
 */
export type BespokeKind =
  | "hash"
  | "confirmation"
  | "act"
  | "subId"
  | "events"
  | "authDetails"
  | "address";

/**
 * Read-side SUBSET a claim belongs to — the curated extraction groups that
 * `extract-claims.ts` derives (`FIELD_KEYS`/`RFC8693_KEYS`/`POP_KEYS`). The three
 * are DISJOINT (a claim is in at most one), so a single mark suffices; a claim in
 * NONE (SET-only `events`, `txn`, the profile and sensitive sets) carries no mark
 * and is not extracted into `DomainClaims`.
 *   - `"core"`     the flat `FIELD_KEYS` field set (StdClaims & OidcClaims & …).
 *   - `"rfc8693"`  the recursive delegation claims (`act`/`mayAct`).
 *   - `"pop"`      the recursive confirmation claim (`confirmation`).
 */
export type ClaimSubset = "core" | "rfc8693" | "pop";

/**
 * Which read-side bucket a claim belongs to. Every registry entry declares
 * exactly one:
 *   - `"claims"`   — the standard/protocol claim set (RFC / OIDC top-level).
 *   - `"profile"`  — the OIDC Core §5.1 profile set (`AegisProfile`).
 *   - `"sensitive"`— government-issued personal identifiers (`AegisSensitive`).
 * A claim NOT in the registry buckets to `custom` — so `custom` is the ABSENCE
 * of an entry, never a category value. The `"sensitive"` category is read at
 * runtime (extract-sensitive-claims.ts) to gate the §13.3 honour-only-when-
 * encrypted read behaviour; `"profile"` still buckets via extract-aegis-profile.
 */
export type ClaimCategory = "claims" | "profile" | "sensitive";

export type TemporalClaimSpec = {
  /**
   * VALIDATION-temporal direction — set ONLY on the time claims the verifier
   * range-checks against "now", the single source of truth for the temporal
   * matcher set. NOT every `value: "date"` claim: `updatedAt` is a date but a
   * profile timestamp, not validation-temporal, so it carries no mark.
   *   - `"past"`    must not be in the future (value <= now + tolerance):
   *                 `nbf`/`iat`/`auth_time`.
   *   - `"future"`  must not be in the past (value >= now - tolerance): `exp`.
   */
  temporal?: "past" | "future";
};

export type ClaimSpec = {
  /** Common-layer key (the domain vocabulary). */
  domain: string;
  /** JOSE wire claim name. */
  jose: string;
  /**
   * COSE/CWT string name, present ONLY when it differs from `jose` (RFC 8392's
   * registered set diverges only at `jti` → `cti`). Absent ⇒ the COSE name
   * equals `jose`. This is the source of truth for the JOSE↔COSE NAME
   * divergence set: `domainToCose`/`coseToDomain` emit/look up this name, and it
   * drives `CwtWireClaims`. The numeric label lives in `cose`, the string name here.
   */
  coseName?: string;
  /**
   * COSE/CWT map key. A number is an integer label (RFC-registered, or a
   * private-use `< -65536` label chosen when the byte-size rule favours it).
   * `null` ⇒ no integer label; the COSE encoder uses the `jose` string as the
   * CBOR map key.
   */
  cose: number | null;
  value: ClaimValueKind;
  /**
   * Bespoke sub-kind — REQUIRED on and ONLY on `value: "bespoke"` entries (drift
   * guard: `bespoke` present iff `value === "bespoke"`). The single source of
   * truth the translator's bespoke encode/decode switch and the COSE byte-shaper
   * (`HASH_DOMAINS`/`ACT_DOMAINS`) dispatch on. See {@link BespokeKind}.
   */
  bespoke?: BespokeKind;
  /** Read-side bucket (exactly one per entry). See {@link ClaimCategory}. */
  category: ClaimCategory;
  /**
   * Read-side extraction subset — the source of truth for extract-claims'
   * `FIELD_KEYS`/`RFC8693_KEYS`/`POP_KEYS`. Absent ⇒ the claim is not extracted
   * into `DomainClaims` (SET-only `events`/`txn`, profile, sensitive). See
   * {@link ClaimSubset}.
   */
  subset?: ClaimSubset;
  /**
   * Closed-enum value→digit map for COSE (non-lossy: unknown values are written
   * as their real string). Omitted for open-valued claims.
   */
  values?: Readonly<Record<string, number>>;
  /**
   * How an array claim tolerates a scalar on READ — meaningful ONLY on
   * `value: "array"` entries, the single source of truth for the read-side split:
   *   - `"spaced"`  a space-delimited STRING is accepted and SPLIT into the array
   *                 (`"a b"` -> `["a","b"]`): `roles`/`scope`/`permissions`/
   *                 `conformsTo`.
   *   - `"strict"`  arrays ONLY; a scalar decodes to `undefined`: `amr`/`afr`/
   *                 `entitlements`/`groups`/`preferredAccessibility`.
   * `audience` is the deliberate exception (no mark): RFC 7519 `aud` is
   * string-OR-array, so a scalar wraps to a single-element array (its own decoder).
   */
  array?: "spaced" | "strict";
} & TemporalClaimSpec;

// First private-use COSE label is the first integer below the -65536 boundary.
// Claims with no registered CWT label but a long JOSE name (≥ 5 chars) get a
// stable, sequential label here so they encode to 5 bytes instead of name+1.
// These are meaningful only to a verifier holding this registry; off-platform
// they degrade to their JOSE string key (never dropped).
const P = (n: number): number => -65537 - n;

/**
 * The registry. Order groups by COSE-key category for readability; lookups are
 * by the derived maps below, not by position.
 */
export const CLAIMS_REGISTRY: ReadonlyArray<ClaimSpec> = [
  // --- (a) RFC 8392 standard CWT claims (registered integer labels 1–9) ---
  {
    domain: "issuer",
    jose: "iss",
    cose: 1,
    value: "text",
    category: "claims",
    subset: "core",
  },
  {
    domain: "subject",
    jose: "sub",
    cose: 2,
    value: "text",
    category: "claims",
    subset: "core",
  },
  {
    domain: "audience",
    jose: "aud",
    cose: 3,
    value: "array",
    category: "claims",
    subset: "core",
  },
  {
    domain: "expiresAt",
    jose: "exp",
    cose: 4,
    value: "date",
    category: "claims",
    temporal: "future",
    subset: "core",
  },
  {
    domain: "notBefore",
    jose: "nbf",
    cose: 5,
    value: "date",
    category: "claims",
    temporal: "past",
    subset: "core",
  },
  {
    domain: "issuedAt",
    jose: "iat",
    cose: 6,
    value: "date",
    category: "claims",
    temporal: "past",
    subset: "core",
  },
  // CWT cti (RFC 8392 label 7)
  {
    domain: "tokenId",
    jose: "jti",
    coseName: "cti",
    cose: 7,
    value: "bstr",
    category: "claims",
    subset: "core",
  },
  // RFC 8747
  {
    domain: "confirmation",
    jose: "cnf",
    cose: 8,
    value: "bespoke",
    bespoke: "confirmation",
    category: "claims",
    subset: "pop",
  },
  // RFC 8693
  {
    domain: "scope",
    jose: "scope",
    cose: 9,
    value: "array",
    category: "claims",
    array: "spaced",
    subset: "core",
  },

  // --- (b) No registered integer label AND a short JOSE name (≤ 4 chars):
  //     string-keyed in CBOR (interoperable; the string key is the smaller
  //     encoding). Includes the standards-based assurance levels
  //     (ISO/IEC 29115 / NIST SP 800-63A/B/C) and the short lindorm hints.
  {
    domain: "authContextClassReference",
    jose: "acr",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },
  {
    domain: "authMethods",
    jose: "amr",
    cose: null,
    value: "array",
    category: "claims",
    array: "strict",
    subset: "core",
  },
  {
    domain: "authorizedParty",
    jose: "azp",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },
  {
    domain: "vectorOfTrust",
    jose: "vot",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },
  {
    domain: "vectorTrustMark",
    jose: "vtm",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },
  // RFC 8693
  {
    domain: "act",
    jose: "act",
    cose: null,
    value: "bespoke",
    bespoke: "act",
    category: "claims",
    subset: "rfc8693",
  },
  {
    domain: "grantType",
    jose: "gty",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },
  // OIDC front-channel logout
  {
    domain: "sessionId",
    jose: "sid",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },
  // RFC 8417 txn — emitted but NOT extracted into DomainClaims (no subset mark).
  {
    domain: "transactionId",
    jose: "txn",
    cose: null,
    value: "text",
    category: "claims",
  },
  // ISO/IEC 29115
  {
    domain: "levelOfAssurance",
    jose: "loa",
    cose: null,
    value: "int",
    category: "claims",
    subset: "core",
  },
  // NIST SP 800-63B
  {
    domain: "authenticatorAssuranceLevel",
    jose: "aal",
    cose: null,
    value: "int",
    category: "claims",
    subset: "core",
  },
  // NIST SP 800-63A
  {
    domain: "identityAssuranceLevel",
    jose: "ial",
    cose: null,
    value: "int",
    category: "claims",
    subset: "core",
  },
  // NIST SP 800-63C
  {
    domain: "federationAssuranceLevel",
    jose: "fal",
    cose: null,
    value: "int",
    category: "claims",
    subset: "core",
  },
  {
    domain: "authFactor",
    jose: "afr",
    cose: null,
    value: "array",
    category: "claims",
    array: "strict",
    subset: "core",
  },
  {
    domain: "sessionHint",
    jose: "sih",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },
  {
    domain: "subjectHint",
    jose: "suh",
    cose: null,
    value: "text",
    category: "claims",
    subset: "core",
  },

  // --- (c) No registered integer label but a long JOSE name (≥ 5 chars):
  //     a private-use integer label (5 bytes) beats the string key (name + 1).
  //     Compact integer on-platform; degrades to the JOSE string key
  //     off-platform (proprietary:false) — NEVER dropped.
  // OIDC `nonce` is NOT CWT label 10 (that is EAT `eat_nonce`, RFC 9711); it is
  // a request-binding text string with no registered CWT label.
  {
    domain: "accessTokenHash",
    jose: "at_hash",
    cose: P(0),
    value: "bespoke",
    bespoke: "hash",
    category: "claims",
    subset: "core",
  },
  {
    domain: "codeHash",
    jose: "c_hash",
    cose: P(1),
    value: "bespoke",
    bespoke: "hash",
    category: "claims",
    subset: "core",
  },
  {
    domain: "stateHash",
    jose: "s_hash",
    cose: P(2),
    value: "bespoke",
    bespoke: "hash",
    category: "claims",
    subset: "core",
  },
  {
    domain: "nonce",
    jose: "nonce",
    cose: P(3),
    value: "text",
    category: "claims",
    subset: "core",
  },
  {
    domain: "authTime",
    jose: "auth_time",
    cose: P(4),
    value: "date",
    category: "claims",
    temporal: "past",
    subset: "core",
  },
  // RFC 9396
  {
    domain: "authorizationDetails",
    jose: "authorization_details",
    cose: P(5),
    value: "bespoke",
    bespoke: "authDetails",
    category: "claims",
    subset: "core",
  },
  // RFC 8693
  {
    domain: "mayAct",
    jose: "may_act",
    cose: P(6),
    value: "bespoke",
    bespoke: "act",
    category: "claims",
    subset: "rfc8693",
  },
  {
    domain: "entitlements",
    jose: "entitlements",
    cose: P(7),
    value: "array",
    category: "claims",
    array: "strict",
    subset: "core",
  },
  {
    domain: "groups",
    jose: "groups",
    cose: P(8),
    value: "array",
    category: "claims",
    array: "strict",
    subset: "core",
  },
  {
    domain: "roles",
    jose: "roles",
    cose: P(9),
    value: "array",
    category: "claims",
    array: "spaced",
    subset: "core",
  },
  {
    domain: "permissions",
    jose: "permissions",
    cose: P(10),
    value: "array",
    category: "claims",
    array: "spaced",
    subset: "core",
  },
  {
    domain: "clientId",
    jose: "client_id",
    cose: P(11),
    value: "text",
    category: "claims",
    subset: "core",
  },

  // --- SET claims (RFC 8417 / RFC 9493). `subjectId` (RFC 9493) IS extracted
  //     (subset "core"); `events` is SET-token-specific and NOT extracted, so it
  //     carries no subset mark.
  // RFC 9493
  {
    domain: "subjectId",
    jose: "sub_id",
    cose: P(12),
    value: "bespoke",
    bespoke: "subId",
    category: "claims",
    subset: "core",
  },
  // RFC 8417 SET events
  {
    domain: "events",
    jose: "events",
    cose: P(13),
    value: "bespoke",
    bespoke: "events",
    category: "claims",
  },

  {
    domain: "tenantId",
    jose: "tenant_id",
    cose: P(14),
    value: "text",
    category: "claims",
    subset: "core",
  },

  // RS-facing posture signal (token-claims.md §2/§3): the profiles the token's
  // issuing client clears above the `permissive` floor. Long JOSE name, no
  // registered CWT label ⇒ private-use label (append-only: never renumber).
  {
    domain: "conformsTo",
    jose: "conforms_to",
    cose: P(15),
    value: "array",
    category: "claims",
    array: "spaced",
    subset: "core",
  },

  // --- SENSITIVE identity claims (government-issued personal identifiers) ---
  //     The `AegisSensitive` set: national identity / social-security numbers
  //     and their OIDC §5.1 verified flags. They travel FLAT on the wire; the
  //     `category: "sensitive"` mark drives read-side bucketing — the sensitive
  //     claims are honoured ONLY on an encrypted token (jwe/cwe) and suppressed
  //     otherwise (OIDC Core §13.3; extract-sensitive-claims.ts). Long JOSE names
  //     ⇒ private-use labels (append-only).
  {
    domain: "nationalIdentityNumber",
    jose: "national_identity_number",
    cose: P(16),
    value: "text",
    category: "sensitive",
  },
  {
    domain: "nationalIdentityNumberVerified",
    jose: "national_identity_number_verified",
    cose: P(17),
    value: "bool",
    category: "sensitive",
  },
  {
    domain: "socialSecurityNumber",
    jose: "social_security_number",
    cose: P(18),
    value: "text",
    category: "sensitive",
  },
  {
    domain: "socialSecurityNumberVerified",
    jose: "social_security_number_verified",
    cose: P(19),
    value: "bool",
    category: "sensitive",
  },

  // --- OIDC §5.1 PROFILE claims (the `AegisProfile` set) ---
  //     Personalization / contact-card fields. `category: "profile"` so read-side
  //     bucketing (a later phase) can collect them into `VerifiedToken.profile`.
  //     `value` is DERIVED from the AegisProfile field type (string→text,
  //     boolean→bool, number-NumericDate→date, string[]→array, nested object→
  //     bespoke). Long JOSE names ⇒ private-use labels (append-only after P(19));
  //     the 4-char `name` stays string-keyed (cose:null) per the byte-rule. No
  //     code reads the category yet — pure metadata this phase. NOTE: the OIDC
  //     `profile` URL claim registers under domain/jose "profile"; that is the
  //     CLAIM name and is distinct from the `category: "profile"` bucket.
  {
    domain: "address",
    jose: "address",
    cose: P(20),
    value: "bespoke",
    bespoke: "address",
    category: "profile",
  },
  { domain: "email", jose: "email", cose: P(21), value: "text", category: "profile" },
  {
    domain: "emailVerified",
    jose: "email_verified",
    cose: P(22),
    value: "bool",
    category: "profile",
  },
  {
    domain: "phoneNumber",
    jose: "phone_number",
    cose: P(23),
    value: "text",
    category: "profile",
  },
  {
    domain: "phoneNumberVerified",
    jose: "phone_number_verified",
    cose: P(24),
    value: "bool",
    category: "profile",
  },
  { domain: "picture", jose: "picture", cose: P(25), value: "text", category: "profile" },
  {
    domain: "birthdate",
    jose: "birthdate",
    cose: P(26),
    value: "text",
    category: "profile",
  },
  {
    domain: "familyName",
    jose: "family_name",
    cose: P(27),
    value: "text",
    category: "profile",
  },
  { domain: "gender", jose: "gender", cose: P(28), value: "text", category: "profile" },
  {
    domain: "givenName",
    jose: "given_name",
    cose: P(29),
    value: "text",
    category: "profile",
  },
  { domain: "locale", jose: "locale", cose: P(30), value: "text", category: "profile" },
  {
    domain: "middleName",
    jose: "middle_name",
    cose: P(31),
    value: "text",
    category: "profile",
  },
  // "name" is 4 chars ⇒ string-keyed (the string key is the smaller CBOR encoding).
  { domain: "name", jose: "name", cose: null, value: "text", category: "profile" },
  {
    domain: "nickname",
    jose: "nickname",
    cose: P(32),
    value: "text",
    category: "profile",
  },
  {
    domain: "preferredUsername",
    jose: "preferred_username",
    cose: P(33),
    value: "text",
    category: "profile",
  },
  // OIDC `profile` URL claim — the CLAIM named "profile" (distinct from the bucket).
  { domain: "profile", jose: "profile", cose: P(34), value: "text", category: "profile" },
  // `updatedAt` is a NumericDate (number seconds) ⇒ "date", per the derive-from-type rule.
  {
    domain: "updatedAt",
    jose: "updated_at",
    cose: P(35),
    value: "date",
    category: "profile",
  },
  { domain: "website", jose: "website", cose: P(36), value: "text", category: "profile" },
  {
    domain: "zoneinfo",
    jose: "zoneinfo",
    cose: P(37),
    value: "text",
    category: "profile",
  },
  {
    domain: "displayName",
    jose: "display_name",
    cose: P(38),
    value: "text",
    category: "profile",
  },
  {
    domain: "honorific",
    jose: "honorific",
    cose: P(39),
    value: "text",
    category: "profile",
  },
  {
    domain: "legalName",
    jose: "legal_name",
    cose: P(40),
    value: "text",
    category: "profile",
  },
  {
    domain: "legalNameVerified",
    jose: "legal_name_verified",
    cose: P(41),
    value: "bool",
    category: "profile",
  },
  {
    domain: "namingSystem",
    jose: "naming_system",
    cose: P(42),
    value: "text",
    category: "profile",
  },
  {
    domain: "preferredAccessibility",
    jose: "preferred_accessibility",
    cose: P(43),
    value: "array",
    category: "profile",
    array: "strict",
  },
  {
    domain: "preferredName",
    jose: "preferred_name",
    cose: P(44),
    value: "text",
    category: "profile",
  },
  {
    domain: "pronouns",
    jose: "pronouns",
    cose: P(45),
    value: "text",
    category: "profile",
  },
  {
    domain: "department",
    jose: "department",
    cose: P(46),
    value: "text",
    category: "profile",
  },
  {
    domain: "jobTitle",
    jose: "job_title",
    cose: P(47),
    value: "text",
    category: "profile",
  },
  {
    domain: "occupation",
    jose: "occupation",
    cose: P(48),
    value: "text",
    category: "profile",
  },
  {
    domain: "organization",
    jose: "organization",
    cose: P(49),
    value: "text",
    category: "profile",
  },
];

const byDomain = new Map<string, ClaimSpec>(
  CLAIMS_REGISTRY.map((spec) => [spec.domain, spec]),
);
const byJose = new Map<string, ClaimSpec>(
  CLAIMS_REGISTRY.map((spec) => [spec.jose, spec]),
);
// Integer COSE label -> spec. Only claims carrying an integer label (registered
// or private-use) are keyed; string-keyed claims (`cose: null`) are absent.
const byCose = new Map<number, ClaimSpec>(
  CLAIMS_REGISTRY.filter(
    (spec): spec is ClaimSpec & { cose: number } => spec.cose !== null,
  ).map((spec) => [spec.cose, spec]),
);
// COSE string name -> spec. The COSE name equals the JOSE name unless the
// registry declares a divergent `coseName` (RFC 8392 `jti` -> `cti`), so this
// keys every claim by its effective COSE string name.
const byCoseName = new Map<string, ClaimSpec>(
  CLAIMS_REGISTRY.map((spec) => [spec.coseName ?? spec.jose, spec]),
);

/** Resolve a claim spec by its domain name (or `undefined` if not registered). */
export const claimByDomain = (domain: string): ClaimSpec | undefined =>
  byDomain.get(domain);

/** Resolve a claim spec by its JOSE wire name. */
export const claimByJose = (jose: string): ClaimSpec | undefined => byJose.get(jose);

/** Resolve a claim spec by its integer COSE label (or `undefined`). */
export const claimByCose = (cose: number): ClaimSpec | undefined => byCose.get(cose);

/**
 * Resolve a claim spec by its COSE string name — the `coseName` where the
 * registry declares one (`cti`), else the JOSE name (`iss`, `exp`, …).
 */
export const claimByCoseName = (coseName: string): ClaimSpec | undefined =>
  byCoseName.get(coseName);

/**
 * The registry SUBSET carrying an optional mark, narrowed so the mark is REQUIRED
 * on each returned spec — the one canonical way to derive a mark-based claim set.
 * `specsWith("temporal")` yields specs whose `temporal` is `"past" | "future"`
 * (never `undefined`), so a caller iterates type-safely with no null-check and an
 * exhaustive `switch` on the mark; `specsWith("array")` narrows `array` likewise.
 * Registry declaration order is preserved.
 */
export const claimsWith = <K extends keyof ClaimSpec>(
  mark: K,
): ReadonlyArray<ClaimSpec & Required<Pick<ClaimSpec, K>>> =>
  CLAIMS_REGISTRY.filter(
    (spec): spec is ClaimSpec & Required<Pick<ClaimSpec, K>> => spec[mark] !== undefined,
  );
