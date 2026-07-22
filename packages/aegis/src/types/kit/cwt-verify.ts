import type { AegisVerifyKey } from "../keys/key-selectors.js";

/**
 * Options for the raw wire CWT verify namespaces (`aegis.cwt.verify` /
 * `aegis.cwm.verify`). Pure wire structural knobs — no named domain matchers, no
 * presence policy (those live on the `aegis.verify` domain surface). Claim
 * matching is expressed via the positional wire `assert` predicate over the
 * COSE-name-keyed claims.
 */
export type VerifyCwtOptions = {
  /**
   * Per-call verification key policy — a CHECK on the key the CWT's `kid` names,
   * or a `kryptos` supplied outright for a signature made by a key not in the
   * vault (RFC 7523 `client_secret_jwt`). Consumed by `Aegis`, which resolves
   * the key by kid.
   */
  key?: AegisVerifyKey;
  /** Clock skew tolerance (seconds) for the in-kit temporal range check. */
  clockTolerance?: number;
  /** When set, the token's `typ` must equal this exact COSE media type. */
  typ?: string;
};
