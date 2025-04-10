import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedJws } from "./jws-decode";

export type ParsedJwsHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosSigAlgorithm;
  headerType: "JWS";
};

export type ParsedJws<T extends Buffer | string> = {
  decoded: DecodedJws;
  header: ParsedJwsHeader;
  payload: T;
  token: string;
};
