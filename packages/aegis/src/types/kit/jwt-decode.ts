import type { Dict } from "@lindorm/types";
import type { JwtClaims } from "../claims/wire/jwt-claims.js";
import type { WireTokenHeader } from "../header/wire-header.js";

export type DecodedJwt<C extends Dict = Dict> = {
  header: WireTokenHeader;
  payload: JwtClaims & C;
  signature: string;
};
