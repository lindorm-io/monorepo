import { DecryptedJwe, EncryptedJwe, JweEncryptOptions } from "../types";

export interface ICoseEncryptKit {
  encrypt(data: string, options?: JweEncryptOptions): EncryptedJwe;
  decrypt(token: string): DecryptedJwe;
}
