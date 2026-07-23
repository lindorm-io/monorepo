import type { Dict } from "@lindorm/types";
import type { DomainClaims } from "../../internal/utils/extract-claims.js";
import type { AegisProfile } from "../claims/domain/aegis-profile.js";
import type { AegisSensitive } from "../claims/domain/aegis-sensitive.js";
import type { DomainTokenHeader } from "../header/domain-header.js";
import type { ParsedDpopProof, TokenDelegation } from "./delegation.js";
import type { TokenProfile } from "../profile/profile.js";

/**
 * The unified domain result types (DESIGN §4) — the shape `verify`/`decrypt` NOW
 * return (the Phase 19 swap has shipped). They describe the domain surface's ONE
 * result shape, uniform across all six token formats: domain-keyed claims (never
 * wire names), a full-breadth domain header, and the logical read-side buckets
 * (`claims`/`custom`/`profile`/`sensitive`) that categorise flat wire claims by
 * registry category on read. The buckets have NO wire representation (D2) — they
 * exist only on the result.
 */

/**
 * The token formats the domain surface discriminates on (`VerifiedToken.format`).
 * COSE splits its claims-bearing CWT into `cwt` (COSE_Sign1 / asymmetric) and
 * `cwm` (COSE_Mac0 / symmetric) — the read side reports which by the COSE
 * structure tag (Sign1=18 ⇒ cwt, Mac0=17 ⇒ cwm), mirroring the D6 write split.
 */
export type TokenFormatTag = "jwt" | "jws" | "jwe" | "cwt" | "cwm" | "cws" | "cwe";

/**
 * The STRUCTURED (claims-bearing) subset of {@link TokenFormatTag}: the formats
 * that carry a readable claims layer — a JWT, a CWT (COSE_Sign1), and a CWM
 * (COSE_Mac0). The opaque signed formats (jws/cws) and the encrypted ones
 * (jwe/cwe) are excluded; only these three yield claims to a keyless read, so
 * `aegis.parse` narrows its result `format` to this union.
 */
export type StructuredFormat = "jwt" | "cwt" | "cwm";

/**
 * The `aegis.verify` result — ALWAYS signature-verified (a JWE/CWE is decrypted
 * then its signed inner is required, so authenticity is guaranteed by the type;
 * there is no `signed: false`). Claims arrive domain-keyed and bucketed; the
 * untranslated wire payload is available under `wire` for exact pass-through.
 */
export type VerifiedToken<C extends Dict = Dict> = {
  format: TokenFormatTag;
  /** Set when `format` ∈ {jwe,cwe} wrapped a SIGNED inner token (any of the four). */
  inner?: "jwt" | "cwt" | "cwm" | "jws" | "cws";
  /** EFFECTIVE (innermost) payload content type — how to read `raw`. */
  contentType?: string;
  /**
   * The domain-keyed header carried by every result (R9). ADOPTS the full-breadth
   * {@link DomainTokenHeader} directly — the wire header is translated to these
   * domain names uniformly across JOSE and COSE, so a caller reads
   * `.header.tokenType` / `.header.keyId` / `.header.algorithm` the same way on a
   * JWT and a CWT (COSE-only-absent fields stay `undefined`).
   */
  header: DomainTokenHeader;
  /** Domain-keyed registered claims; `{}` for jws/cws (opaque). */
  claims: DomainClaims;
  /** Non-domain (custom) claim bucket; `{}` for jws/cws. */
  custom: C;
  profile?: AegisProfile;
  sensitive?: AegisSensitive;
  delegation?: TokenDelegation;
  dpop?: ParsedDpopProof;
  /** The opaque payload for jws/cws (string for JWS, Buffer for CWS). */
  raw?: Buffer | string;
  /** The untranslated jose-keyed wire payload, for pass-through / re-emit. */
  wire?: { payload: Dict };
  token: string;
};

/**
 * The profile's `required` domain claims that are ALSO {@link DomainClaims}
 * fields — `Extract` intersects the profile's `required` tuple with the actual
 * claim keys, so required entries that are not domain claims (e.g. `events`,
 * `token_introspection`, `clientId` when absent from the union) are simply
 * skipped, never over-narrowed. The domain-surface twin of `narrowed-jwt.ts`'s
 * `GuaranteedKeys`, retargeted from `ParsedJwtPayload` to `DomainClaims`.
 */
type GuaranteedClaimKeys<P extends TokenProfile> = Extract<
  P["required"][number],
  keyof DomainClaims
>;

/**
 * Make the guaranteed claims PRESENT: strip both the optional modifier AND an
 * explicit `| undefined`, so `enforceVerifyFloor`'s runtime guarantee is
 * reflected in the type and callers stop writing `claims.subject!`.
 */
type PresentClaims<K extends keyof DomainClaims> = {
  [Key in K]-?: Exclude<DomainClaims[Key], undefined>;
};

/**
 * {@link DomainClaims} with a profile's `required` claims made non-optional —
 * the claim-level narrowing the profile verify FLOOR proves at runtime.
 */
export type NarrowedClaims<P extends TokenProfile> = Omit<
  DomainClaims,
  GuaranteedClaimKeys<P>
> &
  PresentClaims<GuaranteedClaimKeys<P>>;

/**
 * A {@link VerifiedToken} whose `claims` reflect a profile's verify floor —
 * returned by profiled `aegis.verify(profile, …)`. The domain-surface successor
 * to `NarrowedJwt`, narrowing `.claims` (not `.payload`).
 */
export type NarrowedToken<P extends TokenProfile, C extends Dict = Dict> = Omit<
  VerifiedToken<C>,
  "claims"
> & { claims: NarrowedClaims<P> };
