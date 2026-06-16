/**
 * The single claim registry: the one place that maps each aegis DOMAIN claim
 * to its JOSE wire name, its COSE/CWT label, and how its value is encoded.
 *
 * Both encoders consume this — the JOSE encoder maps `domain → jose`, the COSE
 * encoder maps `domain → cose`. Keeping it in one table is the anti-drift
 * mechanism: a claim is defined exactly once.
 *
 * Provenance: the `domain ↔ jose` half mirrors `extract-claims.ts` `FIELD_KEYS`
 * (the existing source of truth for wire↔domain) — a drift-guard test asserts
 * they stay in sync.
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
  | "array" // array of strings (aud, scope, roles…)
  | "bstr" // byte string on the COSE wire (cti…)
  | "bespoke"; // needs a per-claim builder (cnf, hashes, act, sub_id, events…)

export type ClaimSpec = {
  /** Common-layer key (the domain vocabulary). */
  domain: string;
  /** JOSE wire claim name. */
  jose: string;
  /**
   * COSE/CWT map key. A number is an integer label (RFC-registered, or a
   * private-use `< -65536` label chosen when the byte-size rule favours it).
   * `null` ⇒ no integer label; the COSE encoder uses the `jose` string as the
   * CBOR map key.
   */
  cose: number | null;
  value: ClaimValueKind;
  /**
   * Closed-enum value→digit map for COSE (non-lossy: unknown values are written
   * as their real string). Omitted for open-valued claims.
   */
  values?: Readonly<Record<string, number>>;
};

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
export const CLAIM_REGISTRY: ReadonlyArray<ClaimSpec> = [
  // --- (a) RFC 8392 standard CWT claims (registered integer labels 1–9) ---
  { domain: "issuer", jose: "iss", cose: 1, value: "text" },
  { domain: "subject", jose: "sub", cose: 2, value: "text" },
  { domain: "audience", jose: "aud", cose: 3, value: "array" },
  { domain: "expiresAt", jose: "exp", cose: 4, value: "date" },
  { domain: "notBefore", jose: "nbf", cose: 5, value: "date" },
  { domain: "issuedAt", jose: "iat", cose: 6, value: "date" },
  { domain: "tokenId", jose: "jti", cose: 7, value: "bstr" }, // CWT cti
  { domain: "confirmation", jose: "cnf", cose: 8, value: "bespoke" }, // RFC 8747
  { domain: "scope", jose: "scope", cose: 9, value: "array" }, // RFC 8693

  // --- (b) No registered integer label AND a short JOSE name (≤ 4 chars):
  //     string-keyed in CBOR (interoperable; the string key is the smaller
  //     encoding). Includes the standards-based assurance levels
  //     (ISO/IEC 29115 / NIST SP 800-63A/B/C) and the short lindorm hints.
  { domain: "authContextClass", jose: "acr", cose: null, value: "text" },
  { domain: "authMethods", jose: "amr", cose: null, value: "array" },
  { domain: "authorizedParty", jose: "azp", cose: null, value: "text" },
  { domain: "vectorOfTrust", jose: "vot", cose: null, value: "text" },
  { domain: "vectorTrustMark", jose: "vtm", cose: null, value: "text" },
  { domain: "act", jose: "act", cose: null, value: "bespoke" }, // RFC 8693
  { domain: "grantType", jose: "gty", cose: null, value: "text" },
  { domain: "sessionId", jose: "sid", cose: null, value: "text" }, // OIDC front-channel logout
  { domain: "transactionId", jose: "txn", cose: null, value: "text" }, // RFC 8417 txn
  { domain: "levelOfAssurance", jose: "loa", cose: null, value: "int" }, // ISO/IEC 29115
  { domain: "authenticatorAssuranceLevel", jose: "aal", cose: null, value: "int" }, // NIST SP 800-63B
  { domain: "identityAssuranceLevel", jose: "ial", cose: null, value: "int" }, // NIST SP 800-63A
  { domain: "federationAssuranceLevel", jose: "fal", cose: null, value: "int" }, // NIST SP 800-63C
  { domain: "authFactor", jose: "afr", cose: null, value: "array" },
  { domain: "sessionHint", jose: "sih", cose: null, value: "text" },
  { domain: "subjectHint", jose: "suh", cose: null, value: "text" },

  // --- (c) No registered integer label but a long JOSE name (≥ 5 chars):
  //     a private-use integer label (5 bytes) beats the string key (name + 1).
  //     Compact integer on-platform; degrades to the JOSE string key
  //     off-platform (proprietary:false) — NEVER dropped.
  // OIDC `nonce` is NOT CWT label 10 (that is EAT `eat_nonce`, RFC 9711); it is
  // a request-binding text string with no registered CWT label.
  { domain: "accessTokenHash", jose: "at_hash", cose: P(0), value: "bespoke" },
  { domain: "codeHash", jose: "c_hash", cose: P(1), value: "bespoke" },
  { domain: "stateHash", jose: "s_hash", cose: P(2), value: "bespoke" },
  { domain: "nonce", jose: "nonce", cose: P(3), value: "text" },
  { domain: "authTime", jose: "auth_time", cose: P(4), value: "date" },
  {
    domain: "authorizationDetails",
    jose: "authorization_details",
    cose: P(5),
    value: "bespoke",
  }, // RFC 9396
  { domain: "mayAct", jose: "may_act", cose: P(6), value: "bespoke" }, // RFC 8693
  { domain: "entitlements", jose: "entitlements", cose: P(7), value: "array" },
  { domain: "groups", jose: "groups", cose: P(8), value: "array" },
  { domain: "roles", jose: "roles", cose: P(9), value: "array" },
  { domain: "permissions", jose: "permissions", cose: P(10), value: "array" },
  { domain: "clientId", jose: "client_id", cose: P(11), value: "text" },

  // --- SET claims (RFC 8417 / RFC 9493). Emitted by mint but NOT extracted
  //     into DomainClaims (they are SET-token-specific), so they live in the
  //     registry but not in extract-claims FIELD_KEYS.
  { domain: "subjectId", jose: "sub_id", cose: P(12), value: "bespoke" }, // RFC 9493
  { domain: "events", jose: "events", cose: P(13), value: "bespoke" }, // RFC 8417 SET events

  { domain: "tenantId", jose: "tenant_id", cose: P(14), value: "text" },
];

const byDomain = new Map<string, ClaimSpec>(
  CLAIM_REGISTRY.map((spec) => [spec.domain, spec]),
);
const byJose = new Map<string, ClaimSpec>(
  CLAIM_REGISTRY.map((spec) => [spec.jose, spec]),
);
const byCose = new Map<number, ClaimSpec>(
  CLAIM_REGISTRY.filter((spec) => spec.cose !== null).map((spec) => [
    spec.cose as number,
    spec,
  ]),
);

/** Resolve a claim spec by its domain name (or `undefined` if not registered). */
export const specByDomain = (domain: string): ClaimSpec | undefined =>
  byDomain.get(domain);

/** Resolve a claim spec by its JOSE wire name. */
export const specByJose = (jose: string): ClaimSpec | undefined => byJose.get(jose);

/** Resolve a claim spec by its COSE integer label. */
export const specByCose = (cose: number): ClaimSpec | undefined => byCose.get(cose);
