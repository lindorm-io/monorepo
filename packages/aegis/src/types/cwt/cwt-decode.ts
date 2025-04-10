import { Dict } from "@lindorm/types";
import { TokenHeaderClaims } from "../header";
import { JwtClaims } from "../jwt";

export type DecodedCwt<C extends Dict = Dict> = {
  protected: Pick<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  unprotected: Omit<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  payload: JwtClaims & C;
  signature: Buffer;
};
