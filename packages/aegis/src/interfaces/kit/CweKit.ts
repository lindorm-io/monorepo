import type { CweDecryptResult, CweEncryptOptions } from "../../classes/CweKit.js";
import type { Tag } from "../../internal/cose/cbor.js";
import type { DecodedEncryptedToken } from "../../types/index.js";

/**
 * The COSE_Encrypt0 kit — the COSE analogue of {@link IJweKit}. `encrypt`
 * produces a COSE structure (`Tag`) and `decrypt` consumes one; `decode` reads
 * an encoded COSE token to its unified wire header ONLY (the content stays
 * ciphertext), uniform with JWE decode.
 */
export interface ICweKit {
  encrypt(payload: Buffer, options?: CweEncryptOptions): Tag;
  decrypt(encrypt0: unknown): CweDecryptResult;
  decode(token: Buffer): DecodedEncryptedToken;
}
