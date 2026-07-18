import type { AegisVerifyKey } from "../aegis.js";

export type VerifyCwsOptions = {
  /**
   * Per-call verification key policy — a CHECK on the key the COSE_Sign1's `kid`
   * names, applied before the signature is checked. Consumed by `Aegis`, which
   * resolves the key by kid (never a header-embedded key).
   */
  key?: AegisVerifyKey;
};
