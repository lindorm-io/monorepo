import type { AegisVerifyKey } from "../aegis.js";

export type VerifyJwsOptions = {
  /**
   * Per-call verification key policy — a CHECK on the key the JWS's `kid`
   * names, applied before the signature is checked. Consumed by `Aegis`, which
   * resolves the key; `JwsKit` (handed an explicit key) ignores it.
   */
  key?: AegisVerifyKey;
};
