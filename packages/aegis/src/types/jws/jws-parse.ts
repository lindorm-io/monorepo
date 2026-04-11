import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { RefinedTokenHeader } from "../header";
import { DecodedJws } from "./jws-decode";

export type ParsedJwsHeader = RefinedTokenHeader<KryptosSigAlgorithm>;

export type ParsedJws<T extends Buffer | string> = {
  decoded: DecodedJws;
  header: ParsedJwsHeader;
  payload: T;
  token: string;
};
