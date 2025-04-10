import { TokenHeaderClaims } from "../header";
import { CoseSignContent } from "./cose-sign-kit";

export type DecodedCoseSign<T extends CoseSignContent> = {
  protected: Pick<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  unprotected: Omit<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  payload: T;
  signature: string;
};
