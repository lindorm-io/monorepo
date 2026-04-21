import type { DecryptedJwe, EncryptedJwe, JweEncryptOptions } from "../types/index.js";

export interface IJweKit {
  encrypt(data: string, options?: JweEncryptOptions): EncryptedJwe;
  decrypt(token: string): DecryptedJwe;
}
