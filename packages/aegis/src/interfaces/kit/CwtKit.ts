import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type {
  CwtClaimsWire,
  SignStructuredTokenOptions,
  VerifiedStructuredToken,
  VerifyStructuredTokenOptions,
} from "../../types/index.js";

/**
 * The COSE_Sign1 claims kit — the COSE analogue of {@link IJwtKit}. Wire-only:
 * transform-free `sign` and structural `verify`. The keyless `decode` that mirrors
 * JWT decode (unified wire header + cleartext wire claims, no signature check) is a
 * static on the class, not an instance method.
 */
export interface ICwtKit {
  sign<C extends Dict = Dict>(
    claims: CwtClaimsWire & C,
    options?: SignStructuredTokenOptions,
  ): Buffer;
  verify<C extends Dict = Dict>(
    token: Buffer,
    assert?: Condition<CwtClaimsWire & C>,
    options?: VerifyStructuredTokenOptions,
  ): VerifiedStructuredToken<CwtClaimsWire & C>;
}
