import type {
  DecodedEncryptedToken,
  DecryptedEncryptedToken,
  JweEncryptOptions,
  TokenContent,
} from "../../types/index.js";

export interface IJweKit {
  /** Encrypt arbitrary content; the cty is negotiated. Returns the BARE compact JWE. */
  encrypt(data: TokenContent, options?: JweEncryptOptions): string;
  decrypt<T extends TokenContent = Buffer>(
    token: string,
  ): DecryptedEncryptedToken<T, string>;
  /**
   * WIRE-only read (no decryption): the unified wire header (protected +
   * unprotected merged) ONLY — the content stays ciphertext. Uniform with
   * `CweKit` decode.
   */
  decode(token: string): DecodedEncryptedToken<string>;
}
