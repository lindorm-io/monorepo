import { CweContent, CweEncryptOptions, DecryptedCwe, EncryptedCwe } from "../types";

export interface ICweKit {
  encrypt(data: CweContent, options?: CweEncryptOptions): EncryptedCwe;
  decrypt<T extends CweContent = string>(token: CweContent): DecryptedCwe<T>;
}
