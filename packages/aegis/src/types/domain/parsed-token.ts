import type { Dict } from "@lindorm/types";
import type { TokenClaims } from "../claims/domain/domain-claims.js";
import type { AegisProfile } from "../claims/domain/aegis-profile.js";
import type { AegisSensitive } from "../claims/domain/aegis-sensitive.js";
import type { DomainTokenHeader } from "../header/domain-header.js";
import type { TokenDelegation } from "./delegation.js";
import type { StructuredFormat } from "./verified-token.js";

/**
 * The `aegis.parse` result — the keyless, UNVERIFIED CLAIMS read of a STRUCTURED
 * token (a JWT, a CWT, or a CWM). `parse` is fundamentally a claims reader, so it
 * only handles the three claims-bearing formats: the opaque signed formats
 * (jws/cws) carry no claims layer and the encrypted ones (jwe/cwe) are ciphertext,
 * so `parse` throws for both rather than returning a degenerate result. That lets
 * this type be STRICT — `claims`/`custom` are always present, and there are no
 * optional slots for opaque payloads (`raw`), wire pass-through (`wire`), an
 * enclosing envelope (`wrapper`/`contentType`), or the verify-only DPoP binding
 * (`dpop`).
 *
 * UNVERIFIED means there is NO signature guarantee: the claims are whatever the
 * wire carried and nothing here proves the token is authentic (use `aegis.verify`
 * for that). `delegation`, if present, is the EXTRACTED-but-unvalidated actor
 * chain — read straight off the `act` claim without validating the chain.
 */
export type ParsedToken<C extends Dict = Dict> = {
  /** The structured format read: `jwt`, `cwt` (COSE_Sign1), or `cwm` (COSE_Mac0). */
  format: StructuredFormat;
  /**
   * THE header, domain-keyed and uniform across JOSE and COSE — the two wire
   * buckets merged under the header registry's `placement` allowlist, protected
   * last. See {@link VerifiedToken.header} for why the domain tier reports one.
   *
   * ⚠ UNVERIFIED like everything else here: `parse` checks no signature, so even
   * the protected parameters are only what the wire carried.
   */
  header: DomainTokenHeader;
  /** Domain-keyed registered claims — always present for a structured token. */
  claims: TokenClaims;
  /** Non-domain (custom) claim bucket — always present for a structured token. */
  custom: C;
  profile?: AegisProfile;
  sensitive?: AegisSensitive;
  delegation?: TokenDelegation;
  token: string;
};
