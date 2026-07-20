import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { RefinedDomainTokenHeader } from "../header.js";
import type { DecodedJws } from "./jws-decode.js";

export type ParsedJwsHeader = RefinedDomainTokenHeader<KryptosSigAlgorithm>;

export type ParsedJws<T extends Buffer | string> = {
  decoded: DecodedJws;
  header: ParsedJwsHeader;
  payload: T;
  token: string;
};
