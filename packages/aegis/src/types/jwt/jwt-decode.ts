import type { Dict } from "@lindorm/types";
import type { JwtClaims } from "../claims/jwt/jwt-claims.js";
import type { WireTokenHeader } from "../header.js";

export type DecodedJwt<C extends Dict = Dict> = {
  header: WireTokenHeader;
  payload: JwtClaims & C;
  signature: string;
};
