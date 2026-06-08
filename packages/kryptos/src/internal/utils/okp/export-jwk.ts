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
          data: { component: "crv", expected: options.curve, received: crv ?? null },
        },
      );
    }
    if (!d) {
      throw new KryptosError("Key export failed [d]: missing private key component", {
        code: "okp_jwk_export_failed",
        data: { component: "d" },
      });
    }
    if (!x) {
      throw new KryptosError("Key export failed [x]: missing x coordinate", {
        code: "okp_jwk_export_failed",
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
          data: { component: "crv", expected: options.curve, received: crv ?? null },
        },
      );
    }
    if (!x) {
      throw new KryptosError("Key export failed [x]: missing x coordinate", {
        code: "okp_jwk_export_failed",
        data: { component: "x" },
      });
    }

    result.x = x;
  }

  if (!result.x.length) {
    throw new KryptosError("Key export failed: no x coordinate available", {
      code: "okp_jwk_export_failed",
      data: { curve: options.curve },
    });
  }

  return result;
};
