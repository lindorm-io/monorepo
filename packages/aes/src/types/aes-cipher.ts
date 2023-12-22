import { EncryptAesDataOptions } from "./aes-data";
import { AesEncryptionKey, AesSecret } from "./aes-encryption-key";

export type EncryptAesCipherOptions = EncryptAesDataOptions;

export type DecryptAesCipherOptions = {
  cipher: string;
  key?: AesEncryptionKey;
  secret?: AesSecret;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};
