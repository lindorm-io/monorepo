import type { AegisDecryptKey, AegisEncKey } from "./keys/key-selectors.js";

export type AesEncryptOptions = {
  /**
   * Per-call encryption key policy. Consumed by `Aegis`, which resolves the
   * key; its `encryption` picks the content-encryption AEAD.
   */
  key?: AegisEncKey;
  /**
   * RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo (apu/apv). Only the ECDH-ES
   * key-agreement algorithms consume them; forwarded to `AesKit` and emitted on
   * the AES header so the recipient re-derives the identical key.
   */
  apu?: Buffer;
  apv?: Buffer;
};

export type AesDecryptOptions = {
  /**
   * Per-call decryption key policy — a CHECK (plus injectable `kryptos`) on the
   * key the ciphertext names. Consumed by `Aegis`, which resolves the key.
   */
  key?: AegisDecryptKey;
};
