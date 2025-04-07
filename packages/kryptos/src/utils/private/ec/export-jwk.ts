import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { EcJwk, KryptosBuffer, KryptosExportMode } from "../../../types";
import { isEcCurve } from "./is-ec-curve";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<EcJwk, "kid" | "alg" | "kty" | "use">;

export const exportEcToJwk = (options: Options): Result => {
  if (!isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required");
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
      throw new KryptosError("Key export failed [ crv ]");
    }
    if (!d) {
      throw new KryptosError("Key export failed [ d ]");
    }
    if (!x) {
      throw new KryptosError("Key export failed [ x ]");
    }
    if (!y) {
      throw new KryptosError("Key export failed [ y ]");
    }

    result.d = d;
    result.x = x;
    result.y = y;
  }

  if (!result.x.length && !result.y.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key is required");
    }

    const keyObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
    const { crv, x, y } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError("Key export failed [ crv ]");
    }
    if (!x) {
      throw new KryptosError("Key export failed [ x ]");
    }
    if (!y) {
      throw new KryptosError("Key export failed [ y ]");
    }

    result.x = x;
    result.y = y;
  }

  if (!result.x?.length || !result.y?.length) {
    throw new KryptosError("Key export failed");
  }

  return result;
};
