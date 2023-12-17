import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { AesCipherKey } from "./aes";

export type EncryptAesCipherOptions = {
  algorithm?: AesAlgorithm;
  data: string;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  key?: AesCipherKey;
  keyId?: string;
  secret?: string;
};

export type DecryptAesCipherOptions = {
  cipher: string;
  key?: AesCipherKey;
  secret?: string;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};
