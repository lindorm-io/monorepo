import type { AegisDecryptKey } from "../aegis.js";

export type CweDecryptOptions = {
  /**
   * Per-call decryption key policy — a CHECK (plus injectable `kryptos`) on the
   * key the COSE_Encrypt0's `kid` names. Consumed by `Aegis`, which resolves one.
   */
  key?: AegisDecryptKey;
};

/**
 * The result of decrypting a COSE_Encrypt0 (`cwe.decrypt`). The COSE analogue of
 * `DecryptedJwe`; the plaintext is returned as raw bytes because a COSE_Encrypt0
 * protects an opaque byte payload (the content-encryption is self-describing on
 * the wire, so no separate decoded header is surfaced here).
 */
export type DecryptedCwe = {
  payload: Buffer;
  token: string;
};
