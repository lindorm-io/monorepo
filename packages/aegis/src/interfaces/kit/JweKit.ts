import type {
  JoseDecryptedEncryptedToken,
  DecryptTokenOptions,
  JweEncryptOptions,
  TokenContent,
} from "../../types/index.js";

export interface IJweKit {
  /** Encrypt arbitrary content; the cty is negotiated. Returns the BARE compact JWE. */
  encrypt(data: TokenContent, options?: JweEncryptOptions): string;
  decrypt<T extends TokenContent = Buffer>(
    token: string,
    options?: DecryptTokenOptions,
  ): JoseDecryptedEncryptedToken<T>;
}
