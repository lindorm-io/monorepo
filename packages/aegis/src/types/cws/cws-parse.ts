import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedCws } from "./cws-decode";

export type ParsedCwsHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosSigAlgorithm;
  headerType: "application/cose; cose-type=cose-sign";
};

export type ParsedCws<T extends Buffer | string> = {
  decoded: DecodedCws<T>;
  header: ParsedCwsHeader;
  payload: T;
  token: string;
};
