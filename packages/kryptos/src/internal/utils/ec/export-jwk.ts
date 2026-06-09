import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { EcJwk, KryptosBuffer, KryptosExportMode } from "../../../types/index.js";
import { isEcCurve } from "./is-ec-curve.js";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<EcJwk, "kid" | "alg" | "kty" | "use">;

export const exportEcToJwk = (options: Options): Result => {
  if (!isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required", {
      code: "missing_ec_curve",
      title: "Missing EC Curve",
      details:
        "A valid EC curve (P-256, P-384, or P-521) must be provided to export the key to a JWK.",
    });
  }

  const result: Result = {
    crv: options.curve,
    x: "",
    y: "",
  };

  if (options.mode === "private" && options.privateKey) {
    const keyObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs8",
    });
    const { crv, d, x, y } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError(
        `Key export failed [crv]: expected ${options.curve}, got ${crv}`,
        {
          code: "ec_jwk_export_failed",
          title: "EC JWK Export Failed",
          details: "The exported JWK crv did not match the requested EC curve.",
          data: { component: "crv", expected: options.curve, received: crv ?? null },
        },
      );
    }
    if (!d) {
      throw new KryptosError("Key export failed [d]: missing private key component", {
        code: "ec_jwk_export_failed",
        title: "EC JWK Export Failed",
        details:
          "The exported JWK is missing the d component required for an EC private key.",
        data: { component: "d" },
      });
    }
    if (!x) {
      throw new KryptosError("Key export failed [x]: missing x coordinate", {
        code: "ec_jwk_export_failed",
        title: "EC JWK Export Failed",
        details: "The exported JWK is missing the x coordinate required for an EC key.",
        data: { component: "x" },
      });
    }
    if (!y) {
      throw new KryptosError("Key export failed [y]: missing y coordinate", {
        code: "ec_jwk_export_failed",
        title: "EC JWK Export Failed",
        details: "The exported JWK is missing the y coordinate required for an EC key.",
        data: { component: "y" },
      });
    }

    result.d = d;
    result.x = x;
    result.y = y;
  }

  if (!result.x.length && !result.y.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key is required", {
        code: "missing_ec_public_key",
        title: "Missing EC Public Key",
        details:
          "No private key produced JWK coordinates and no public key was supplied to export the EC JWK.",
      });
    }

    const keyObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
    const { crv, x, y } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError(
        `Key export failed [crv]: expected ${options.curve}, got ${crv}`,
        {
          code: "ec_jwk_export_failed",
          title: "EC JWK Export Failed",
          details: "The exported JWK crv did not match the requested EC curve.",
          data: { component: "crv", expected: options.curve, received: crv ?? null },
        },
      );
    }
    if (!x) {
      throw new KryptosError("Key export failed [x]: missing x coordinate", {
        code: "ec_jwk_export_failed",
        title: "EC JWK Export Failed",
        details: "The exported JWK is missing the x coordinate required for an EC key.",
        data: { component: "x" },
      });
    }
    if (!y) {
      throw new KryptosError("Key export failed [y]: missing y coordinate", {
        code: "ec_jwk_export_failed",
        title: "EC JWK Export Failed",
        details: "The exported JWK is missing the y coordinate required for an EC key.",
        data: { component: "y" },
      });
    }

    result.x = x;
    result.y = y;
  }

  if (!result.x?.length || !result.y?.length) {
    throw new KryptosError("Key export failed", {
      code: "ec_jwk_export_failed",
      title: "EC JWK Export Failed",
      details:
        "Neither the private nor public key path produced both x and y coordinates for the EC JWK.",
      data: { curve: options.curve },
    });
  }

  return result;
};
