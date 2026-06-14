import { KryptosError } from "../../../errors/index.js";
import type { AkpJwk } from "../../../types/index.js";
import { ML_DSA_PUBLIC_KEY_SIZES, ML_DSA_SEED_SIZE } from "./sizes.js";

/**
 * RFC 9964 §3 / §4 / §7.3 — validates the AKP JWK key material sizes on the
 * import path before the key is handed to Node's crypto layer.
 *
 *  - `alg` is REQUIRED (RFC 9964 §3) and must name a supported ML-DSA variant.
 *  - `priv` (when present) MUST decode to exactly the 32-byte ML-DSA seed.
 *  - `pub` MUST decode to the fixed per-algorithm ML-DSA public-key size.
 */
export const assertAkpJwk = (jwk: AkpJwk): void => {
  const alg = jwk.alg;

  if (!alg || !(alg in ML_DSA_PUBLIC_KEY_SIZES)) {
    throw new KryptosError("Missing or unsupported AKP algorithm", {
      code: "invalid_akp_algorithm",
      title: "Invalid AKP Algorithm",
      details:
        "An AKP JWK MUST declare an 'alg' naming a supported ML-DSA variant (ML-DSA-44, ML-DSA-65, or ML-DSA-87).",
      debug: { alg },
    });
  }

  const expectedPublicKeySize = ML_DSA_PUBLIC_KEY_SIZES[alg];

  if (jwk.priv !== undefined) {
    const privLength = Buffer.from(jwk.priv, "base64url").length;

    if (privLength !== ML_DSA_SEED_SIZE) {
      throw new KryptosError("Invalid AKP seed length", {
        code: "invalid_akp_seed_length",
        title: "Invalid AKP Seed Length",
        details: `The AKP JWK 'priv' parameter MUST be the ${ML_DSA_SEED_SIZE}-byte ML-DSA seed.`,
        debug: { alg, expected: ML_DSA_SEED_SIZE, actual: privLength },
      });
    }
  }

  const pubLength = Buffer.from(jwk.pub ?? "", "base64url").length;

  if (pubLength !== expectedPublicKeySize) {
    throw new KryptosError("Invalid AKP public key length", {
      code: "invalid_akp_public_key_length",
      title: "Invalid AKP Public Key Length",
      details: `The AKP JWK 'pub' parameter for ${alg} MUST be ${expectedPublicKeySize} bytes.`,
      debug: { alg, expected: expectedPublicKeySize, actual: pubLength },
    });
  }
};
