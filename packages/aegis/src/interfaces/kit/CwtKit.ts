import type { Dict, Predicate } from "@lindorm/types";
import type {
  CwtClaimsWire,
  DecodedStructuredToken,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";

/**
 * The COSE_Sign1 claims kit — the COSE analogue of {@link IJwtKit}. Wire-only:
 * transform-free `sign`, structural `verify`, and a `decode` that mirrors JWT
 * decode (unified wire header + cleartext wire claims, no signature check).
 */
export interface ICwtKit {
  sign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options?: SignStructuredTokenOptions,
  ): Buffer;
  verify<C extends Dict = Dict>(
    token: Buffer,
    assert?: Predicate<CwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions,
  ): VerifiedStructuredToken<CwtClaimsWire & C>;
  decode<C extends Dict = Dict>(token: Buffer): DecodedStructuredToken<CwtClaimsWire & C>;
}
