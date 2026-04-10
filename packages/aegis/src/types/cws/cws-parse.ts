import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedCws } from "./cws-decode";

export type ParsedCwsHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosSigAlgorithm;
  headerType: string;
};

export type ParsedCws<T extends Buffer | string> = {
  decoded: DecodedCws<T>;
  header: ParsedCwsHeader;
  payload: T;
  token: string;
};
