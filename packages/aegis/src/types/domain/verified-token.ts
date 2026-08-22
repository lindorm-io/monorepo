import type { Dict } from "@lindorm/types";
import type { EncryptedToken } from "./encrypted-token.js";
import type { TokenFormat } from "./token-format.js";
import type { DomainClaims } from "../claims/domain/domain-claims.js";
import type { AegisProfile } from "../claims/domain/aegis-profile.js";
import type { AegisSensitive } from "../claims/domain/aegis-sensitive.js";
import type { DomainTokenHeader } from "../header/domain-header.js";
import type { TokenContent } from "../kit/content.js";
import type { ParsedDpopProof, TokenDelegation } from "./delegation.js";
import type { VerifyGuaranteedClaims } from "../profile/policy.js";
import type { TokenProfile } from "../profile/profile.js";

/**
 * The unified domain result types — the shape `verify`/`decrypt` return. They
 * describe the domain surface's ONE result shape, uniform across all six token
 * formats: domain-keyed claims (never wire names), a full-breadth domain header,
 * and the logical read-side buckets (`claims`/`custom`/`profile`/`sensitive`)
 * that categorise flat wire claims by registry category on read. The buckets
 * have NO wire representation — they exist only on the result.
 */

/**
 * The token formats the domain surface discriminates on (`VerifiedToken.format`).
 * COSE splits its claims-bearing CWT into `cwt` (COSE_Sign1 / asymmetric) and
 * `cwm` (COSE_Mac0 / symmetric) — the read side reports which by the COSE
 * structure tag (Sign1=18 ⇒ cwt, Mac0=17 ⇒ cwm), mirroring the write split
 * `selectCoseClaimsKit` makes off the resolved key's `algClass`.
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
  /**
   * The token's OWN kind — the SIGNED token's format, whether or not it arrived
   * inside an envelope. `verify` always returns a signature-verified token, so
   * this is never an encrypting format; see {@link VerifiedToken.wrapper}.
   */
  format: TokenFormat;
  /**
   * The envelope this token arrived in, when it arrived in one.
   *
   * ⚠ ITS PRESENCE IS THE DISCRIMINATOR. An encrypted id_token verifies to
   * `{ format: "jwt", wrapper: "jwe" }` and a plain one to `{ format: "jwt" }`,
   * so a caller asking what the token IS gets one answer either way — which is
   * the whole point. Branch on `wrapper` only when the envelope itself matters.
   */
  wrapper?: EncryptedToken["format"];
  /** EFFECTIVE (innermost) payload content type — how to read `raw`. */
  contentType?: string;
  /**
   * THE header, domain-keyed and uniform across JOSE and COSE.
   *
   * ⚠ ONE header, deliberately. `protectedHeader`/`unprotectedHeader` is a COSE
   * STRUCTURAL fact (RFC 9052 §3) — a compact JOSE token has a single header and
   * no such bucket (RFC 7515 §7.1) — so a split here put one wire's vocabulary on
   * a surface that speaks neither, and left every JOSE result with a field that
   * could never be populated. The KIT tier still reports both buckets, because
   * that tier speaks its own wire.
   *
   * What a split bought is bought here by CONSTRUCTION instead. The buckets are
   * merged under the header registry's `placement` allowlist — the unprotected
   * one first, filtered to the parameters permitted there, then overwritten by
   * the protected one — so the only values that can arrive unauthenticated are
   * `kid` and `iv`, the routing/AEAD infrastructure that rides the unprotected
   * bucket (RFC 9052 §3.1). Every
   * parameter a verifier routes, audits or polices a token by is
   * `placement: "protected"` and is dropped on read exactly as it is refused on
   * write, so it cannot reach this header unsigned.
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
  /**
   * The opaque payload of a jws/cws — as the TYPE it was signed as, not as the
   * wire's preferred shape. The content type carries that across: an object is
   * signed under `application/json` and comes back a Dict, a string under
   * `text/plain` comes back a string, bytes under `application/octet-stream` come
   * back a Buffer. There is no per-wire split to state.
   */
  raw?: TokenContent;
  /** The untranslated jose-keyed wire payload, for pass-through / re-emit. */
  wire?: { payload: Dict };
  token: string;
};

/**
 * A {@link VerifiedToken} PROVEN to carry a readable claims layer — the narrowed
 * result of {@link import("../../utils/is-structured-token.js").isStructuredToken}.
 *
 * ⭐ ONE SHAPE. `format` is the token's own kind and `wrapper` the envelope, so
 * one arm expresses both shapes: an encrypted id_token (OIDC
 * `id_token_encrypted_response_alg`) verifies to `{ format: "jwt", wrapper:
 * "jwe" }` and a plain one to `{ format: "jwt" }`. Both qualify by the same test.
 *
 * ⚠ A second arm keyed on the envelope would put the readable-claims fact in a
 * different field depending on how the token was packaged, which is the shape a
 * hand-rolled `format === "jwt"` check misses. `wrapper` never changes what the
 * token IS.
 */
export type StructuredVerifiedToken<C extends Dict = Dict> = VerifiedToken<C> & {
  format: StructuredFormat;
};

/**
 * The domain claims a profile's policy GUARANTEES on a verified token — the
 * `required` rules that name the VERIFY direction, intersected with the actual
 * claim keys, so entries that are not domain claims (e.g. `events`,
 * `token_introspection`) are simply skipped, never over-narrowed.
 *
 * ⚠ The direction filter is load-bearing: a requirement a profile declares for
 * mint alone says nothing about the token that arrived, so narrowing off it
 * would put a guarantee in the type that no runtime check makes.
 */
type GuaranteedClaimKeys<P extends TokenProfile> = Extract<
  VerifyGuaranteedClaims<P["policy"][number]>,
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
