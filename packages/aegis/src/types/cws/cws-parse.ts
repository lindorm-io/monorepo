import { KryptosSigAlgorithm } from "@lindorm/kryptos";
import { RefinedTokenHeader } from "../header";
import { DecodedCws } from "./cws-decode";

export type ParsedCwsHeader = RefinedTokenHeader<KryptosSigAlgorithm>;

export type ParsedCws<T extends Buffer | string> = {
  decoded: DecodedCws<T>;
  header: ParsedCwsHeader;
  payload: T;
  token: string;
};
