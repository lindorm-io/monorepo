import { Dict } from "@lindorm/types";
import { CoseProtectedHeaderKey } from "#internal/constants/cose";
import { TokenHeaderClaims } from "../header";
import { JwtClaims } from "../claims/jwt/jwt-claims";

export type DecodedCwt<C extends Dict = Dict> = {
  protected: Pick<TokenHeaderClaims, CoseProtectedHeaderKey>;
  unprotected: Omit<TokenHeaderClaims, CoseProtectedHeaderKey>;
  payload: JwtClaims & C;
  signature: Buffer;
};
