import { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedJwe } from "./jwe-decode";

export type DecryptedJweHeader = Omit<
  ParsedTokenHeader,
  "algorithm" | "encryption" | "type"
> & {
  algorithm: KryptosEncAlgorithm;
  encryption: KryptosEncryption;
  type: "JWE";
};

export type DecryptedJwe = {
  decoded: DecodedJwe;
  header: DecryptedJweHeader;
  payload: string;
  token: string;
};
