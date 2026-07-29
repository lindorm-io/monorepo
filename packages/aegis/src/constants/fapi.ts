import type { KryptosSigAlgorithm } from "@lindorm/kryptos";

/**
 * The FAPI 2.0 signing-algorithm allowlist.
 *
 * FAPI is deployment policy, not a property of a key, so aegis does not enforce
 * it — it publishes the list and the deployment applies it as a selector:
 *
 * ```ts
 * await aegis.mint("id_token", content, {
 *   sign: { condition: { algorithm: { $in: FAPI_SIG_ALGS } } },
 * });
 * ```
 */
export const FAPI_SIG_ALGS: Array<KryptosSigAlgorithm> = ["PS256", "ES256", "EdDSA"];
