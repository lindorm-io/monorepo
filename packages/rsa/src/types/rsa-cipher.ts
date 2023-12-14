import { RsaFormat } from "../enums";
import { RsaKey } from "./rsa-key";

export type EncryptRsaCipherOptions = {
  format?: RsaFormat;
  data: string;
  key: RsaKey;
};

export type DecryptRsaCipherOptions = {
  cipher: string;
  format?: RsaFormat;
  key: RsaKey;
};

export type VerifyRsaCipherOptions = DecryptRsaCipherOptions & {
  data: string;
};
