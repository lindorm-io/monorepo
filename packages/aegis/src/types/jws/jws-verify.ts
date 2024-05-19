import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedJws } from "./jws-decode";

export type VerifiedJwsHeader = Omit<ParsedTokenHeader, "algorithm" | "type"> & {
  algorithm: KryptosSigAlgorithm;
  type: "JWS";
};

export type VerifiedJws<T extends Buffer | string> = {
  __jws: DecodedJws;
  header: VerifiedJwsHeader;
  payload: T;
};
