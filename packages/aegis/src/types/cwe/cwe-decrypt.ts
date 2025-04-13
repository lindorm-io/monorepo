import { KryptosEncAlgorithm } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedCwe } from "./cwe-decode";
import { CweContent } from "./cwe-kit";

export type DecryptedCweHeader = Omit<ParsedTokenHeader, "algorithm" | "headerType"> & {
  algorithm: KryptosEncAlgorithm;
  headerType: "application/cose; cose-type=cose-encrypt";
};

export type DecryptedCwe<T extends CweContent = string> = {
  decoded: DecodedCwe;
  header: DecryptedCweHeader;
  payload: T;
  token: string;
};
