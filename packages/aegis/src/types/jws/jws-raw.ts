import { TokenHeaderClaims } from "../header";

export type DecodedJws = {
  header: TokenHeaderClaims;
  payload: string;
  signature: string;
};
