import type { TokenHeaderClaims } from "../header.js";

export type DecodedJws = {
  header: TokenHeaderClaims;
  payload: string;
  signature: string;
};
