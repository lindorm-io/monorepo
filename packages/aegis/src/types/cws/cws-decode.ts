import { CoseProtectedHeaderKey } from "#internal/constants/cose";
import { TokenHeaderClaims } from "../header";
import { CwsContent } from "./cws-kit";

export type DecodedCws<T extends CwsContent> = {
  protected: Pick<TokenHeaderClaims, CoseProtectedHeaderKey>;
  unprotected: Omit<TokenHeaderClaims, CoseProtectedHeaderKey>;
  payload: T;
  signature: string;
};
