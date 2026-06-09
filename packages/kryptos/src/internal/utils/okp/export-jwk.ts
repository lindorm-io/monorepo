import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosExportMode, OkpJwk } from "../../../types/index.js";
import { isOkpCurve } from "./is-okp-curve.js";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<OkpJwk, "kid" | "alg" | "kty" | "use">;

export const exportOkpToJwk = (options: Options): Result => {
  if (!isOkpCurve(options.curve)) {
    throw new KryptosError("Invalid OKP curve", {
      code: "invalid_okp_curve",
      title: "Invalid OKP Curve",
      details:
        "A valid OKP curve (Ed25519, Ed448, X25519, or X448) must be provided to export the key to a JWK.",
      data: { curve: options.curve ?? null },
    });
  }

  const result: Result = {
    crv: options.curve,
    x: "",
  };

  if (options.mode === "private" && options.privateKey) {
    const keyObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs8",
    });
    const { crv, d, x } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError(
        `Key export failed [crv]: expected ${options.curve}, got ${crv}`,
        {
          code: "okp_jwk_export_failed",
          title: "OKP JWK Export Failed",
          details: "The exported JWK crv did not match the requested OKP curve.",
          data: { component: "crv", expected: options.curve, received: crv ?? null },
        },
      );
    }
    if (!d) {
      throw new KryptosError("Key export failed [d]: missing private key component", {
        code: "okp_jwk_export_failed",
        title: "OKP JWK Export Failed",
        details:
          "The exported JWK is missing the d component required for an OKP private key.",
        data: { component: "d" },
      });
    }
    if (!x) {
      throw new KryptosError("Key export failed [x]: missing x coordinate", {
        code: "okp_jwk_export_failed",
        title: "OKP JWK Export Failed",
        details: "The exported JWK is missing the x coordinate required for an OKP key.",
        data: { component: "x" },
      });
    }

    result.d = d;
    result.x = x;
  }

  if (!result.x.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key not available", {
        code: "missing_okp_public_key",
        title: "Missing OKP Public Key",
        details:
          "No private key produced a JWK x coordinate and no public key was supplied to export the OKP JWK.",
      });
    }

    const keyObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
    const { crv, x } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError(
        `Key export failed [crv]: expected ${options.curve}, got ${crv}`,
        {
          code: "okp_jwk_export_failed",
          title: "OKP JWK Export Failed",
          details: "The exported JWK crv did not match the requested OKP curve.",
          data: { component: "crv", expected: options.curve, received: crv ?? null },
        },
      );
    }
    if (!x) {
      throw new KryptosError("Key export failed [x]: missing x coordinate", {
        code: "okp_jwk_export_failed",
        title: "OKP JWK Export Failed",
        details: "The exported JWK is missing the x coordinate required for an OKP key.",
        data: { component: "x" },
      });
    }

    result.x = x;
  }

  if (!result.x.length) {
    throw new KryptosError("Key export failed: no x coordinate available", {
      code: "okp_jwk_export_failed",
      title: "OKP JWK Export Failed",
      details:
        "Neither the private nor public key path produced an x coordinate for the OKP JWK.",
      data: { curve: options.curve },
    });
  }

  return result;
};
