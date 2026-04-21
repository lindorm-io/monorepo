import type { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { RefinedTokenHeader } from "../header.js";
import type { DecodedJwe } from "./jwe-decode.js";

export type DecryptedJweHeader = RefinedTokenHeader<KryptosEncAlgorithm> & {
  encryption: KryptosEncryption;
};

export type DecryptedJwe = {
  decoded: DecodedJwe;
  header: DecryptedJweHeader;
  payload: string;
  token: string;
};
