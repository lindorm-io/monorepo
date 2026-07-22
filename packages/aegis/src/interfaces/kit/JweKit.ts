import type {
  DecodedEncryptedToken,
  DecryptedJwe,
  EncryptedJwe,
  JweEncryptOptions,
} from "../../types/index.js";

export interface IJweKit {
  encrypt(data: string, options?: JweEncryptOptions): EncryptedJwe;
  decrypt(token: string): DecryptedJwe;
  /**
   * WIRE-only read (no decryption): the unified wire header (protected +
   * unprotected merged) ONLY — the content stays ciphertext. Uniform with
   * `CweKit` decode.
   */
  decode(token: string): DecodedEncryptedToken;
}
