import { KryptosEncryption } from "@lindorm/kryptos";
import { RefinedTokenHeader } from "../header";
import { DecodedCwe } from "./cwe-decode";
import { CweContent } from "./cwe-kit";

export type DecryptedCweHeader = RefinedTokenHeader<KryptosEncryption>;

export type DecryptedCwe<T extends CweContent = string> = {
  decoded: DecodedCwe;
  header: DecryptedCweHeader;
  payload: T;
  token: string;
};
