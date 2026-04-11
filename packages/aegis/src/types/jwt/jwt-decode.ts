import { Dict } from "@lindorm/types";
import { JwtClaims } from "../claims/jwt/jwt-claims";
import { TokenHeaderClaims } from "../header";

export type DecodedJwt<C extends Dict = Dict> = {
  header: TokenHeaderClaims;
  payload: JwtClaims & C;
  signature: string;
};
