import { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedJwe } from "./jwe-decode";

export type DecryptedJweHeader = Omit<
  ParsedTokenHeader,
  "algorithm" | "encryption" | "headerType"
> & {
  algorithm: KryptosEncAlgorithm;
  encryption: KryptosEncryption;
  headerType: "JWE";
};

export type DecryptedJwe = {
  decoded: DecodedJwe;
  header: DecryptedJweHeader;
  payload: string;
  token: string;
};
