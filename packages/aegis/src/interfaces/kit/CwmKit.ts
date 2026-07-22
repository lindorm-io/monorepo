import type { Predicate } from "@lindorm/types";
import type {
  CwtSignOptions,
  CwtVerifyOptions,
  CwtVerifyResult,
} from "../../internal/cose/cwt-token.js";
import type { CwtWireClaims, DecodedSignedToken } from "../../types/index.js";

/**
 * The COSE_Mac0 claims kit — the symmetric twin of {@link ICwtKit}. Same
 * wire-only surface (transform-free `sign`, structural `verify`, JWT-uniform
 * `decode`); the integrity structure is a MAC rather than a signature.
 */
export interface ICwmKit {
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
