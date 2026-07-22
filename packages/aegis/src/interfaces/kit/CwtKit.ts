import type { Predicate } from "@lindorm/types";
import type {
  CwtSignOptions,
  CwtVerifyOptions,
  CwtVerifyResult,
} from "../../internal/cose/cwt-token.js";
import type { CwtWireClaims, DecodedSignedToken } from "../../types/index.js";

/**
 * The COSE_Sign1 claims kit — the COSE analogue of {@link IJwtKit}. Wire-only:
 * transform-free `sign`, structural `verify`, and a `decode` that mirrors JWT
 * decode (unified wire header + cleartext wire claims, no signature check).
 */
export interface ICwtKit {
  sign<C extends CwtWireClaims = CwtWireClaims>(
    claims: C,
    options?: CwtSignOptions,
  ): Buffer;
  verify<C extends CwtWireClaims = CwtWireClaims>(
    token: Buffer,
    assert?: Predicate<C>,
    options?: CwtVerifyOptions,
  ): CwtVerifyResult<C>;
  decode<C extends CwtWireClaims = CwtWireClaims>(token: Buffer): DecodedSignedToken<C>;
}
