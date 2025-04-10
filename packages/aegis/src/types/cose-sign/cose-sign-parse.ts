import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedCoseSign } from "./cose-sign-decode";

export type ParsedCoseSignHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosSigAlgorithm;
  headerType: "application/cose; cose-type=cose-sign";
};

export type ParsedCoseSign<T extends Buffer | string> = {
  decoded: DecodedCoseSign<T>;
  header: ParsedCoseSignHeader;
  payload: T;
  token: string;
};
