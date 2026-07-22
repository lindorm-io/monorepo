import type { AegisVerifyKey } from "../keys/key-selectors.js";

export type VerifyJwsOptions = {
  /**
   * Per-call verification key policy — a CHECK on the key the JWS's `kid`
   * names, applied before the signature is checked, or a `kryptos` supplied
   * outright for a signature made by a key not in the vault (RFC 7523
   * `client_secret_jwt`). Consumed by `Aegis`, which resolves the key; `JwsKit`
   * (handed an explicit key) ignores it.
   */
  key?: AegisVerifyKey;
};
