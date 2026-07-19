/**
 * The single header registry: the one place that maps each JOSE protected header
 * parameter to its wire name, its aegis DOMAIN name, how its value is shaped,
 * where it comes from, and which directions the codec currently wires.
 *
 * It is the header-side twin of `internal/claims/registry.ts`. `token-header.ts`
 * (the header translator, mirroring `claims/translate.ts`) consumes it in BOTH
 * directions — the parser maps `wire -> domain` (read) and the encoder maps
 * `domain -> wire` (write) — so a header parameter is defined exactly once. The
 * drift-guard test binds the domain names to `ParsedTokenHeader` and the wire
 * names to `TokenHeaderClaims`, so a rename on either side fails the build
 * instead of silently drifting.
 *
 * SCOPE: this registry is the JOSE wire<->domain NAME map only. COSE header LABEL
 * handling (the CBOR integer-label <-> string concern) stays in `internal/cose/*`
 * for now; a COSE header-label registry is the natural next extension of this
 * table (a `coseLabel` field, mirroring the claim registry's `cose`) but is out
 * of scope for this phase.
 */

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
 * Where a header parameter's value comes from — mirrors the Bit-1 analysis. The
 * WRITE side uses this to know which parameters a caller may legitimately set:
 *   - `"option"`   — user-supplyable via `TokenHeaderOptions`.
 *   - `"key"`      — kit-derived from the signing/encrypting kryptos (alg, kid,
 *                    x5t#S256, x5c).
 *   - `"computed"` — produced by the crypto operation itself (epk, iv, tag, p2s).
 */
export type HeaderProvenance = "option" | "key" | "computed";

/**
 * Which directions the codec currently wires the parameter through:
 *   - `"both"` — parsed on read AND emitted on write (the core JOSE header set).
 *   - `"read"` — surfaced by the parser but NOT emitted by any signer yet (x5t is
 *                read into the domain header, but no encoder sets it).
 *   - `"none"` — registry-only, for RFC completeness; neither parsed nor emitted
 *                yet (the Phase-6 additions x5u/zip/apu/apv). Present so the ONE
 *                source of truth already knows the full RFC-registered set; a
 *                later phase flips them to `"read"`/`"both"` when a codec wires
 *                them, without inventing a second name map.
 */
export type HeaderWiring = "both" | "read" | "none";

export type HeaderSpec = {
  /** JOSE wire header name (`alg`, `kid`, `x5t#S256`, `enc`, ...). */
  wire: string;
  /** aegis domain header name (`algorithm`, `keyId`, `x5tS256`, ...). */
  domain: string;
  value: HeaderValueKind;
  provenance: HeaderProvenance;
  wiring: HeaderWiring;
};

/**
 * The registry. Grouped by wiring then ordered alphabetically by wire for
 * readability; lookups and the direction-scoped subsets are derived below, not
 * read by position. The WRITE subset is re-sorted by wire so the emitted JOSE
 * header keys land in their canonical (alphabetical) order on the wire.
 *
 * RFC references: RFC 7515 §4.1 (JWS), RFC 7516 §4.1 (JWE), RFC 7518 §4.6
 * (ECDH-ES), plus the lindorm-proprietary `oid`.
 */
export const HEADER_REGISTRY: ReadonlyArray<HeaderSpec> = [
  // --- (both) the core JOSE header set: parsed AND emitted -----------------
  {
    wire: "alg",
    domain: "algorithm",
    value: "string",
    provenance: "key",
    wiring: "both",
  },
  {
    wire: "crit",
    domain: "critical",
    value: "critical",
    provenance: "option",
    wiring: "both",
  },
  {
    wire: "cty",
    domain: "contentType",
    value: "string",
    provenance: "option",
    wiring: "both",
  },
  {
    wire: "enc",
    domain: "encryption",
    value: "string",
    provenance: "option",
    wiring: "both",
  },
  {
    wire: "epk",
    domain: "publicEncryptionJwk",
    value: "jwk",
    provenance: "computed",
    wiring: "both",
  },
  {
    wire: "iv",
    domain: "initialisationVector",
    value: "buffer",
    provenance: "computed",
    wiring: "both",
  },
  { wire: "jku", domain: "jwksUri", value: "url", provenance: "option", wiring: "both" },
  { wire: "jwk", domain: "jwk", value: "jwk", provenance: "option", wiring: "both" },
  { wire: "kid", domain: "keyId", value: "string", provenance: "key", wiring: "both" },
  {
    wire: "oid",
    domain: "objectId",
    value: "string",
    provenance: "option",
    wiring: "both",
  },
  {
    wire: "p2c",
    domain: "pbkdfIterations",
    value: "number",
    provenance: "option",
    wiring: "both",
  },
  {
    wire: "p2s",
    domain: "pbkdfSalt",
    value: "buffer",
    provenance: "computed",
    wiring: "both",
  },
  {
    wire: "tag",
    domain: "publicEncryptionTag",
    value: "buffer",
    provenance: "computed",
    wiring: "both",
  },
  {
    wire: "typ",
    domain: "headerType",
    value: "string",
    provenance: "option",
    wiring: "both",
  },
  { wire: "x5c", domain: "x5c", value: "array", provenance: "key", wiring: "both" },
  {
    wire: "x5t#S256",
    domain: "x5tS256",
    value: "string",
    provenance: "key",
    wiring: "both",
  },

  // --- (read) parsed into the domain header, not emitted by any signer yet -
  // RFC 7515 §4.1.7 — X.509 certificate SHA-1 thumbprint (base64url).
  { wire: "x5t", domain: "x5t", value: "string", provenance: "option", wiring: "read" },

  // --- (none) registry-only: the full RFC-registered set, not yet wired -----
  // RFC 7518 §4.6.1.2 — ECDH-ES Agreement PartyUInfo (base64url).
  { wire: "apu", domain: "apu", value: "string", provenance: "option", wiring: "none" },
  // RFC 7518 §4.6.1.3 — ECDH-ES Agreement PartyVInfo (base64url).
  { wire: "apv", domain: "apv", value: "string", provenance: "option", wiring: "none" },
  // RFC 7515 §4.1.5 — X.509 URL.
  { wire: "x5u", domain: "x5u", value: "string", provenance: "option", wiring: "none" },
  // RFC 7516 §4.1.3 — compression algorithm ("DEF" is the only registered value).
  { wire: "zip", domain: "zip", value: "string", provenance: "option", wiring: "none" },
];

const byWire = new Map<string, HeaderSpec>(
  HEADER_REGISTRY.map((spec) => [spec.wire, spec]),
);
const byDomain = new Map<string, HeaderSpec>(
  HEADER_REGISTRY.map((spec) => [spec.domain, spec]),
);

/** Resolve a header spec by its JOSE wire name (or `undefined` if unregistered). */
export const headerByWire = (wire: string): HeaderSpec | undefined => byWire.get(wire);

/** Resolve a header spec by its domain name (or `undefined` if unregistered). */
export const headerByDomain = (domain: string): HeaderSpec | undefined =>
  byDomain.get(domain);

/**
 * The registry SUBSET carrying a given `wiring` value — the one canonical way to
 * derive a direction-scoped header set. Registry declaration order is preserved.
 */
export const headersWith = (wiring: HeaderWiring): ReadonlyArray<HeaderSpec> =>
  HEADER_REGISTRY.filter((spec) => spec.wiring === wiring);

/**
 * The parameters the ENCODER emits (`domain -> wire`), sorted by wire name so the
 * emitted JOSE header keys land in their canonical order (matching the historical
 * hand-written object literal, which was alphabetical by wire).
 */
export const WRITE_HEADER_SPECS: ReadonlyArray<HeaderSpec> = HEADER_REGISTRY.filter(
  (spec) => spec.wiring === "both",
)
  .slice()
  .sort((a, b) => (a.wire < b.wire ? -1 : a.wire > b.wire ? 1 : 0));

/** The parameters the PARSER surfaces (`wire -> domain`): everything read-wired. */
export const READ_HEADER_SPECS: ReadonlyArray<HeaderSpec> = HEADER_REGISTRY.filter(
  (spec) => spec.wiring === "both" || spec.wiring === "read",
);
