import type { AegisEncKey } from "../aegis.js";

/**
 * The plaintext a COSE_Encrypt0 protects. COSE encrypts bytes, so a `Buffer`
 * passes through untouched and a `string` is UTF-8 encoded first — the COSE
 * analogue of `jwe.encrypt`, which takes an already-serialised string.
 */
export type CweContent = Buffer | string;

export type CweEncryptOptions = {
  /**
   * Per-call encryption (recipient) key policy. Ignored by the wire kit, which
   * is handed an explicit key; consumed by `Aegis`, which resolves one. Its
   * `encryption` picks the content-encryption AEAD (COSE_Encrypt0 is direct
   * AEAD, so the recipient key is a symmetric `use:"enc"` key).
   */
  key?: AegisEncKey;
  /** COSE `typ` header (label 16) stamped on the COSE_Encrypt0. */
  typ?: string;
};

export type EncryptedCwe = {
  token: string;
};
