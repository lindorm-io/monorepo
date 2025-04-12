import {
  CoseEncryptContent,
  CoseEncryptEncryptOptions,
  DecryptedCoseEncrypt,
  EncryptedCoseEncrypt,
} from "../types";

export interface ICoseEncryptKit {
  encrypt(
    data: CoseEncryptContent,
    options?: CoseEncryptEncryptOptions,
  ): EncryptedCoseEncrypt;
  decrypt<T extends CoseEncryptContent = string>(
    token: CoseEncryptContent,
  ): DecryptedCoseEncrypt<T>;
}
