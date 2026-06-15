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
 * they stay in sync. The `cose` labels are the IANA-registered CWT labels where
 * one exists, a private-use label (`< -65536`, `proprietary: true`) for
 * lindorm-internal claims, or `null` (⇒ the JOSE string name is used as the
 * CBOR map key) for standard claims that have no registered integer label.
 *
 * NOTE: the COSE half is not yet wired into an encoder (that is the later COSE
 * initiative); it is defined here so the domain-keyed core has a complete map.
 */

/** How a claim's VALUE is encoded on each wire. */
export type ClaimValueKind =
  | "text" // string scalar (iss, sub, acr…)
  | "int" // numeric / NumericDate (exp, iat, auth_time…)
  | "array" // array of strings (aud, scope, roles…)
  | "bstr" // byte string on the COSE wire (cti…)
  | "bespoke"; // needs a per-claim builder (cnf, hashes, act, sub_id, events…)

export type ClaimSpec = {
  /** Common-layer key (the domain vocabulary). */
  domain: string;
  /** JOSE wire claim name. */
  jose: string;
  /**
   * COSE/CWT map key. A number is an integer label (RFC-registered, or
   * private-use `< -65536` when `proprietary`). `null` ⇒ no registered integer
   * label; the COSE encoder uses the `jose` string as the CBOR map key.
   */
  cose: number | null;
  value: ClaimValueKind;
  /**
   * Closed-enum value→digit map for COSE (non-lossy: unknown values are written
   * as their real string). Omitted for open-valued claims.
   */
  values?: Readonly<Record<string, number>>;
  /** lindorm-internal claim: private-use label, documented non-interoperable. */
  proprietary?: boolean;
};

// First private-use COSE label is the first integer below the -65536 boundary.
// Lindorm-internal claims get a stable, sequential block here. These are
// aegis-proprietary and only meaningful to a verifier holding this registry.
const P = (n: number): number => -65537 - n;

/**
 * The registry. Order groups by RFC origin for readability; lookups are by the
 * derived maps below, not by position.
 */
export const CLAIM_REGISTRY: ReadonlyArray<ClaimSpec> = [
  // --- RFC 8392 standard CWT claims (registered integer labels) ---
  { domain: "issuer", jose: "iss", cose: 1, value: "text" },
  { domain: "subject", jose: "sub", cose: 2, value: "text" },
  { domain: "audience", jose: "aud", cose: 3, value: "array" },
  { domain: "expiresAt", jose: "exp", cose: 4, value: "int" },
  { domain: "notBefore", jose: "nbf", cose: 5, value: "int" },
  { domain: "issuedAt", jose: "iat", cose: 6, value: "int" },
  { domain: "tokenId", jose: "jti", cose: 7, value: "bstr" }, // CWT cti
  { domain: "confirmation", jose: "cnf", cose: 8, value: "bespoke" }, // RFC 8747
  { domain: "scope", jose: "scope", cose: 9, value: "array" }, // RFC 8693

  // --- Standard JOSE/OAuth/OIDC claims with NO registered CWT integer label.
  //     Kept string-keyed in CBOR (interoperable: a stock verifier reads them).
  // OIDC `nonce` is NOT CWT label 10 (that is EAT `eat_nonce`, RFC 9711); it is
  // a request-binding text string with no registered CWT label → string-keyed.
  { domain: "nonce", jose: "nonce", cose: null, value: "text" },
  { domain: "accessTokenHash", jose: "at_hash", cose: null, value: "bespoke" },
  { domain: "codeHash", jose: "c_hash", cose: null, value: "bespoke" },
  { domain: "stateHash", jose: "s_hash", cose: null, value: "bespoke" },
  { domain: "authContextClass", jose: "acr", cose: null, value: "text" },
  { domain: "authMethods", jose: "amr", cose: null, value: "array" },
  { domain: "authorizedParty", jose: "azp", cose: null, value: "text" },
  { domain: "authTime", jose: "auth_time", cose: null, value: "int" },
  { domain: "vectorOfTrust", jose: "vot", cose: null, value: "text" },
  { domain: "vectorTrustMark", jose: "vtm", cose: null, value: "text" },
  {
    domain: "authorizationDetails",
    jose: "authorization_details",
    cose: null,
    value: "bespoke",
  }, // RFC 9396
  { domain: "act", jose: "act", cose: null, value: "bespoke" }, // RFC 8693
  { domain: "mayAct", jose: "may_act", cose: null, value: "bespoke" }, // RFC 8693
  { domain: "entitlements", jose: "entitlements", cose: null, value: "array" },
  { domain: "groups", jose: "groups", cose: null, value: "array" },
  { domain: "roles", jose: "roles", cose: null, value: "array" },
  { domain: "permissions", jose: "permissions", cose: null, value: "array" },
  { domain: "clientId", jose: "client_id", cose: null, value: "text" },
  { domain: "grantType", jose: "gty", cose: null, value: "text" },
  { domain: "sessionId", jose: "sid", cose: null, value: "text" }, // OIDC front-channel logout

  // --- SET claims (RFC 8417 / RFC 9493). Emitted by mint but NOT extracted
  //     into DomainClaims (they are SET-token-specific), so they live in the
  //     registry but not in extract-claims FIELD_KEYS.
  { domain: "subjectId", jose: "sub_id", cose: null, value: "bespoke" }, // RFC 9493
  { domain: "events", jose: "events", cose: null, value: "bespoke" }, // RFC 8417 SET events
  { domain: "transactionId", jose: "txn", cose: null, value: "text" }, // RFC 8417 txn

  // --- Lindorm-internal claims: private-use COSE labels (proprietary). The
  //     JOSE wire keeps the human name; COSE uses the < -65536 label. Stripped
  //     from off-platform tokens by the `proprietary` mint option.
  {
    domain: "levelOfAssurance",
    jose: "loa",
    cose: P(0),
    value: "int",
    proprietary: true,
  },
  { domain: "authFactor", jose: "afr", cose: P(1), value: "array", proprietary: true },
  { domain: "sessionHint", jose: "sih", cose: P(2), value: "text", proprietary: true },
  { domain: "subjectHint", jose: "suh", cose: P(3), value: "text", proprietary: true },
  { domain: "tenantId", jose: "tenant_id", cose: P(4), value: "text", proprietary: true },
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
