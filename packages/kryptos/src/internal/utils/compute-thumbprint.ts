import { ShaKit } from "@lindorm/sha";
import { KryptosError } from "../../errors";
import { KryptosJwk } from "../../types";

const computeCanonical = (jwk: KryptosJwk): Partial<KryptosJwk> => {
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
      throw new KryptosError(
        `Cannot compute thumbprint: unsupported kty "${jwk.kty as string}"`,
      );
  }
};

export const computeThumbprint = (jwk: KryptosJwk): string =>
  ShaKit.S256(JSON.stringify(computeCanonical(jwk)));
