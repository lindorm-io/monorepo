import { EncryptAesDataOptions } from "./aes-data";
import { AesEncryptionKey } from "./aes-encryption-key";

export type EncryptAesCipherOptions = EncryptAesDataOptions;

export type DecryptAesCipherOptions = {
  cipher: string;
  key?: AesEncryptionKey;
  secret?: string;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};
