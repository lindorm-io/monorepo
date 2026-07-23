import type { Dict, Predicate } from "@lindorm/types";
import type {
  CwtClaimsWire,
  DecodedStructuredToken,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";

/**
 * The COSE_Mac0 claims kit — the symmetric twin of {@link ICwtKit}. Same
 * wire-only surface (transform-free `sign`, structural `verify`, JWT-uniform
 * `decode`); the integrity structure is a MAC rather than a signature.
 */
export interface ICwmKit<C extends Dict = Dict> {
  sign(claims: CwtClaimsWire & C, options?: SignStructuredTokenOptions): Buffer;
  verify(
    token: Buffer,
    assert?: Predicate<CwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions,
  ): VerifiedStructuredToken<CwtClaimsWire & C>;
  decode(token: Buffer): DecodedStructuredToken<CwtClaimsWire & C>;
}
