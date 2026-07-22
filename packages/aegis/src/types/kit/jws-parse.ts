import type { SignedJoseHeader } from "../header/header.js";
import type { DecodedJws } from "./jws-decode.js";

export type ParsedJws<T extends Buffer | string> = {
  decoded: DecodedJws;
  header: SignedJoseHeader;
  payload: T;
  token: string;
};
