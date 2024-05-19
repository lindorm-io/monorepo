import { Dict } from "@lindorm/types";
import { TokenHeaderClaims } from "../header";
import { JwtClaims } from "./jwt-claims";

export type DecodedJwt<C extends Dict = Dict> = {
  header: TokenHeaderClaims;
  payload: JwtClaims & C;
  signature: string;
};
