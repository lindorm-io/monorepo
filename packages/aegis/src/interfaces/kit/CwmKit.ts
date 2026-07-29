import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type {
  CwtClaimsWire,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";

/**
 * The COSE_Mac0 claims kit — the symmetric twin of {@link ICwtKit}. Same
 * wire-only surface (transform-free `sign`, structural `verify`); the integrity
 * structure is a MAC rather than a signature. The keyless `decode` is a static on
 * the class, not an instance method.
 */
export interface ICwmKit<C extends Dict = Dict> {
  sign(claims: CwtClaimsWire & C, options?: SignStructuredTokenOptions): Buffer;
  verify(
    token: Buffer,
    assert?: Condition<CwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions,
  ): VerifiedStructuredToken<CwtClaimsWire & C>;
}
