import { DecryptedJwe, EncryptedJwe, JweEncryptOptions } from "../types";

export interface IJweKit {
  encrypt(data: string, options?: JweEncryptOptions): EncryptedJwe;
  decrypt(token: string): DecryptedJwe;
}
