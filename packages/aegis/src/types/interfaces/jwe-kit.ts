import { DecryptedJwe } from "../jwe/jwe-decrypt";
import { EncryptedJwe, JweEncryptOptions } from "../jwe/jwe-encrypt";

export interface IJweKit {
  encrypt(data: string, options?: JweEncryptOptions): EncryptedJwe;
  decrypt(jwe: string): DecryptedJwe;
}
