import type { AkpAlgorithm } from "../../../types/index.js";

/**
 * RFC 9964 §4 / §7.3 — ML-DSA key material sizes (in bytes).
 *
 * The AKP JWK `priv` parameter MUST be the 32-byte ML-DSA seed (identical
 * for every ML-DSA variant). The `pub` parameter is the raw ML-DSA public
 * key, whose size is fixed per algorithm.
 */
export const ML_DSA_SEED_SIZE = 32;

export const ML_DSA_PUBLIC_KEY_SIZES: Record<AkpAlgorithm, number> = {
  "ML-DSA-44": 1312,
  "ML-DSA-65": 1952,
  "ML-DSA-87": 2592,
};
