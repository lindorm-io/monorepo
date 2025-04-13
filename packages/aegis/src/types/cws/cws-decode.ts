import { TokenHeaderClaims } from "../header";
import { CwsContent } from "./cws-kit";

export type DecodedCws<T extends CwsContent> = {
  protected: Pick<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  unprotected: Omit<TokenHeaderClaims, "alg" | "crit" | "cty" | "typ">;
  payload: T;
  signature: string;
};
