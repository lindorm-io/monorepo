import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { RefinedTokenHeader } from "../header.js";
import type { DecodedJws } from "./jws-decode.js";

export type ParsedJwsHeader = RefinedTokenHeader<KryptosSigAlgorithm>;

export type ParsedJws<T extends Buffer | string> = {
  decoded: DecodedJws;
  header: ParsedJwsHeader;
  payload: T;
  token: string;
};
