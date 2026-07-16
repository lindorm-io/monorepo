import type { AegisDecryptKey, AegisEncKey } from "./aegis.js";

export type AesEncryptOptions = {
  /**
   * Per-call encryption key policy. Consumed by `Aegis`, which resolves the
   * key; its `encryption` picks the content-encryption AEAD.
   */
  key?: AegisEncKey;
};

export type AesDecryptOptions = {
  /**
   * Per-call decryption key policy — a CHECK (plus injectable `kryptos`) on the
   * key the ciphertext names. Consumed by `Aegis`, which resolves the key.
   */
  key?: AegisDecryptKey;
};
