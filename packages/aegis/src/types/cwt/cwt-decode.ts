import { Dict } from "@lindorm/types";
import { JwtClaims } from "../claims/jwt/jwt-claims";
import { TokenHeaderClaims } from "../header";

export type DecodedCwt<C extends Dict = Dict> = {
  protected: Pick<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  unprotected: Omit<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  payload: JwtClaims & C;
  signature: Buffer;
};
