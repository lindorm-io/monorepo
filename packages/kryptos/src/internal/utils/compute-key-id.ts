import { createHash } from "crypto";
import { KryptosError } from "../../errors/index.js";
import type { KryptosJwk } from "../../types/index.js";
import { canonicalJwk } from "./compute-thumbprint.js";
import { keyIdFromBytes } from "./key-id-from-bytes.js";

// Derive a deterministic `key_` id from an asymmetric key's RFC 7638 thumbprint:
// SHA-256 over the canonical (public-members-only) JWK, mapped to base62. The
// same public key — private-only or public-only — always yields the same id.
//
// oct is rejected: its canonical form hashes the secret `k`, so a thumbprint id
// would leak a guess-verification oracle via the kid. oct callers derive ids by
// other means and never route here.
export const computeKeyId = (jwk: KryptosJwk): string => {
  switch (jwk.kty) {
    case "AKP":
    case "EC":
    case "OKP":
    case "RSA": {
      const digest = createHash("sha256")
        .update(JSON.stringify(canonicalJwk(jwk)))
        .digest();

      return keyIdFromBytes(digest);
    }

    case "oct":
      throw new KryptosError("oct keys must not derive a thumbprint id", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details:
          "Symmetric (oct) keys must not derive a key id from their thumbprint; the canonical form hashes the secret and would leak a verification oracle.",
        data: { kty: jwk.kty },
      });

    default:
      throw new KryptosError(
        `Cannot compute key id: unsupported kty "${jwk.kty as string}"`,
        {
          code: "unsupported_key_type",
          title: "Unsupported Key Type",
          details: `The key type "${jwk.kty as string}" is not supported for key id derivation.`,
          data: { kty: jwk.kty },
        },
      );
  }
};
