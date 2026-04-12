import { ShaKit } from "@lindorm/sha";
import { JwtError } from "../../errors";

type RawJwk = Record<string, unknown>;

/**
 * Computes an RFC 7638 JWK Thumbprint from a raw JWK object.
 *
 * The canonical form uses only the required public-key fields for
 * each key type, serialised in lexicographic order per RFC 7638 s3.2.
 */
export const computeJwkThumbprint = (jwk: RawJwk): string => {
  const canonical = computeCanonicalJwk(jwk);
  return ShaKit.S256(JSON.stringify(canonical));
};

const computeCanonicalJwk = (jwk: RawJwk): Record<string, unknown> => {
  switch (jwk.kty) {
    case "EC":
      return { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };

    case "RSA":
      return { e: jwk.e, kty: jwk.kty, n: jwk.n };

    case "OKP":
      return { crv: jwk.crv, kty: jwk.kty, x: jwk.x };

    case "oct":
      return { k: jwk.k, kty: jwk.kty };

    default:
      throw new JwtError(
        `Cannot compute JWK thumbprint: unsupported kty "${String(jwk.kty)}"`,
      );
  }
};
