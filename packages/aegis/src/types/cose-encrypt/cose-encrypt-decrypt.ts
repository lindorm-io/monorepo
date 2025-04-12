import { KryptosEncAlgorithm } from "@lindorm/kryptos";
import { ParsedTokenHeader } from "../header";
import { DecodedCoseEncrypt } from "./cose-encrypt-decode";
import { CoseEncryptContent } from "./cose-encrypt-kit";

export type DecryptedCoseEncryptHeader = Omit<
  ParsedTokenHeader,
  "algorithm" | "headerType"
> & {
  algorithm: KryptosEncAlgorithm;
  headerType: "application/cose; cose-type=cose-encrypt";
};

export type DecryptedCoseEncrypt<T extends CoseEncryptContent = string> = {
  decoded: DecodedCoseEncrypt;
  header: DecryptedCoseEncryptHeader;
  payload: T;
  token: string;
};
