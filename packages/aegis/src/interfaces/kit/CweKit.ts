import type {
  CweEncryptOptions,
  DecodedEncryptedToken,
  DecryptedEncryptedToken,
  TokenContent,
} from "../../types/index.js";

/**
 * The COSE_Encrypt0 kit — the COSE analogue of {@link IJweKit}. `encrypt`
 * serialises arbitrary content (cty negotiated via the shared codec) and returns
 * the BARE encoded COSE token (COSE_Encrypt0 bytes); `decrypt` consumes the ENCODED
 * COSE token bytes (R2 — decoded internally, parallel to JOSE), returning the
 * cty-reconstructed payload + the unified wire header + the native token; `decode`
 * reads an encoded COSE token to its unified wire header ONLY (the content stays
 * ciphertext), uniform with JWE decode.
 */
export interface ICweKit {
  encrypt(content: TokenContent, options?: CweEncryptOptions): Buffer;
  decrypt<T extends TokenContent = Buffer>(
    token: Buffer,
  ): DecryptedEncryptedToken<T, Buffer>;
  decode(token: Buffer): DecodedEncryptedToken<Buffer>;
}
