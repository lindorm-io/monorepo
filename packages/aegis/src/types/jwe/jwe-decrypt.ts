import { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { RefinedTokenHeader } from "../header";
import { DecodedJwe } from "./jwe-decode";

export type DecryptedJweHeader = RefinedTokenHeader<KryptosEncAlgorithm> & {
  encryption: KryptosEncryption;
};

export type DecryptedJwe = {
  decoded: DecodedJwe;
  header: DecryptedJweHeader;
  payload: string;
  token: string;
};
