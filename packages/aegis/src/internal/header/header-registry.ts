/**
 * The single header registry: the one place that maps each JOSE protected header
 * parameter to its wire name, its aegis DOMAIN name, how its value is shaped, and
 * where it comes from.
 *
 * It is the header-side twin of `internal/claims/claims-registry.ts`, and the SINGLE
 * source of truth for BOTH the JOSE wire<->domain NAME map AND the COSE integer
 * header LABEL (the `cose` field, mirroring the claim registry's `cose`). A header
 * parameter — and its COSE label — is defined exactly once.
 *
 * `token-header.ts` (the header translator, mirroring `claims/translate.ts`) is
 * now DATA-DRIVEN: it iterates the actual header data (domain-keyed options on
 * write, wire-keyed decoded claims on read) and looks each key up in the registry,
 * rather than iterating curated direction-scoped subsets. The registry no longer
 * carries a per-entry direction flag — every registered parameter flows through
 * the codec in both directions. The drift-guard test binds the domain names to
 * `DomainTokenHeader` and the JOSE names to `WireTokenHeader`, so a rename on
 * either side fails the build instead of silently drifting. `internal/cose/*`
 * resolves its integer labels from here via `coseByJose`.
 */

import { CoseError } from "../../errors/index.js";

/**
 * How a header parameter's VALUE is shaped, and (on the WRITE side) the defensive
 * guard the encoder applies before putting it on the wire. Most parameters are a
 * plain string passthrough; `crit` is the one member-transforming case.
 */
export type HeaderValueKind =
  | "string" // scalar string, guarded `isString` on write (alg, kid, typ, cty, enc, oid, x5t#S256, x5t, x5u, zip, apu, apv)
  | "url" // URL-like string, guarded `isUrlLike` on write (jku)
  | "number" // finite number, guarded `isFinite` on write (p2c)
  | "jwk" // JWK object, guarded `isObject` on write (jwk, epk)
  | "buffer" // Buffer passthrough on the raw side — base64url-encoded downstream in `encodeJoseHeader` (iv, p2s, tag)
  | "array" // Array<string> passthrough, guarded `Array.isArray` on write (x5c)
  | "critical"; // the `crit` array whose MEMBERS are themselves domain<->wire remapped (crit)

/**
 * Where a header parameter's value comes from — design metadata mirroring the
 * Bit-1 analysis (unread by the codec, exactly parallel to the claim registry's
 * `category`). It records which parameters a caller may legitimately set:
 *   - `"option"`   — user-supplyable via `DomainTokenHeaderOptions`.
 *   - `"key"`      — kit-derived from the signing/encrypting kryptos (alg, kid,
 *                    x5t#S256, x5c).
 *   - `"computed"` — produced by the crypto operation itself (epk, iv, tag, p2s).
 */
export type HeaderProvenance = "option" | "key" | "computed";

export type HeaderSpec = {
  /** aegis domain header name (`algorithm`, `keyId`, `certificateThumbprint`, ...). */
  domain: string;
  /** JOSE wire header name (`alg`, `kid`, `enc`, ...). */
  jose: string;
  /**
   * The IANA COSE Header Parameters integer label (RFC 9052 §3.1 Table 2 for the
   * core set; RFC 9360 Table 1 for the X.509 family). Absent where the JOSE
   * parameter has no COSE label, or where COSE represents it with a structure
   * that is NOT a plain integer relabel (e.g. `x5t`, whose COSE form is a
   * `COSE_CertHash` array, not a base64url thumbprint under one label).
   */
  cose?: number;
  value: HeaderValueKind;
  provenance: HeaderProvenance;
};

/**
 * The registry. Ordered alphabetically by jose for readability only — the codec
 * no longer reads by position or by any direction-scoped subset, so the ordering
 * is not load-bearing. Lookups are derived from the Maps below.
 *
 * RFC references: RFC 7515 §4.1 (JWS), RFC 7516 §4.1 (JWE), RFC 7518 §4.6
 * (ECDH-ES), RFC 9360 (X.509 COSE labels), plus the lindorm-proprietary `oid`.
 */
export const HEADER_REGISTRY: ReadonlyArray<HeaderSpec> = [
  { domain: "algorithm", jose: "alg", cose: 1, value: "string", provenance: "key" },
  // RFC 7518 §4.6.1.2 — ECDH-ES Agreement PartyUInfo (base64url).
  { domain: "partyProducer", jose: "apu", value: "string", provenance: "option" },
  // RFC 7518 §4.6.1.3 — ECDH-ES Agreement PartyVInfo (base64url).
  { domain: "partyRecipient", jose: "apv", value: "string", provenance: "option" },
  { domain: "critical", jose: "crit", cose: 2, value: "critical", provenance: "option" },
  { domain: "contentType", jose: "cty", cose: 3, value: "string", provenance: "option" },
  { domain: "encryption", jose: "enc", value: "string", provenance: "option" },
  {
    domain: "publicEncryptionJwk",
    jose: "epk",
    value: "jwk",
    provenance: "computed",
  },
  {
    domain: "initialisationVector",
    jose: "iv",
    cose: 5,
    value: "buffer",
    provenance: "computed",
  },
  { domain: "jwksUri", jose: "jku", value: "url", provenance: "option" },
  { domain: "jwk", jose: "jwk", value: "jwk", provenance: "option" },
  { domain: "keyId", jose: "kid", cose: 4, value: "string", provenance: "key" },
  { domain: "objectId", jose: "oid", value: "string", provenance: "option" },
  { domain: "pbkdfIterations", jose: "p2c", value: "number", provenance: "option" },
  { domain: "pbkdfSalt", jose: "p2s", value: "buffer", provenance: "computed" },
  {
    domain: "publicEncryptionTag",
    jose: "tag",
    value: "buffer",
    provenance: "computed",
  },
  {
    domain: "headerType",
    jose: "typ",
    cose: 16, // RFC 9596
    value: "string",
    provenance: "option",
  },
  {
    domain: "certificateChain",
    jose: "x5c",
    cose: 33, // RFC 9360 x5chain
    value: "array",
    provenance: "key",
  },
  // RFC 7515 §4.1.7 — X.509 certificate SHA-1 thumbprint (base64url). Kit-derived
  // from the signing/encrypting kryptos (like `x5t#S256`), auto-emitted whenever a
  // cert is bound; the write side gates it behind a boolean, the read side never
  // verifies it. Intentionally has NO `cose` label: COSE's x5t (label 34, RFC 9360)
  // is a `COSE_CertHash` structure (`[algId, hashValue]`), NOT a plain relabel of
  // JOSE's base64url thumbprint, so there is no faithful JOSE-wire representation.
  // Leaving it unmapped means `headerByCose(34)` is undefined, so a foreign COSE
  // token's x5t CertHash is SKIPPED on decode rather than silently mis-shaped into
  // a bogus string.
  {
    domain: "certificateThumbprintSha1",
    jose: "x5t",
    value: "string",
    provenance: "key",
  },
  {
    domain: "certificateThumbprint",
    jose: "x5t#S256",
    value: "string",
    provenance: "key",
  },
  // RFC 7515 §4.1.5 — X.509 URL. COSE label 35 (RFC 9360 x5u).
  {
    domain: "certificateUrl",
    jose: "x5u",
    cose: 35,
    value: "string",
    provenance: "option",
  },
  // RFC 7516 §4.1.3 — compression algorithm ("DEF" is the only registered value).
  { domain: "zip", jose: "zip", value: "string", provenance: "option" },
];

const byJose = new Map<string, HeaderSpec>(
  HEADER_REGISTRY.map((spec) => [spec.jose, spec]),
);
const byDomain = new Map<string, HeaderSpec>(
  HEADER_REGISTRY.map((spec) => [spec.domain, spec]),
);
// Integer COSE label -> spec. Only entries carrying a `cose` label are keyed;
// parameters COSE has no plain integer label for are absent.
const byCose = new Map<number, HeaderSpec>(
  HEADER_REGISTRY.filter(
    (spec): spec is HeaderSpec & { cose: number } => spec.cose !== undefined,
  ).map((spec) => [spec.cose, spec]),
);

/** Resolve a header spec by its JOSE wire name (or `undefined` if unregistered). */
export const headerByJose = (jose: string): HeaderSpec | undefined => byJose.get(jose);

/** Resolve a header spec by its domain name (or `undefined` if unregistered). */
export const headerByDomain = (domain: string): HeaderSpec | undefined =>
  byDomain.get(domain);

/** Resolve a header spec by its integer COSE label (or `undefined` if none). */
export const headerByCose = (label: number): HeaderSpec | undefined => byCose.get(label);

/**
 * The COSE integer header label for a JOSE wire parameter — the single source of
 * truth the COSE kits emit onto the wire. THROWS if the parameter carries no
 * `cose` label (COSE has no plain integer relabel for it), which is the drift
 * guard against a caller asking for a label that does not exist.
 */
export const coseByJose = (jose: string): number => {
  const label = byJose.get(jose)?.cose;

  if (label === undefined) {
    throw new CoseError("No COSE label for header parameter", {
      code: "header_no_cose_label",
      data: { jose },
      title: "No COSE Label For Header Parameter",
      details:
        "The header registry has no COSE integer label for this JOSE wire parameter; COSE either omits it or represents it with a non-integer structure.",
    });
  }

  return label;
};
