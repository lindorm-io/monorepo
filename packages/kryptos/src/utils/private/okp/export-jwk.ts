import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosBuffer, KryptosExportMode, OkpJwk } from "../../../types";
import { isOkpCurve } from "./is-okp-curve";

type Options = Omit<KryptosBuffer, "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<OkpJwk, "alg" | "kty" | "use">;

export const exportOkpToJwk = (options: Options): Result => {
  if (!isOkpCurve(options.curve)) {
    throw new KryptosError("Curve is required");
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
      throw new KryptosError("Key export failed [ crv ]");
    }
    if (!d) {
      throw new KryptosError("Key export failed [ d ]");
    }
    if (!x) {
      throw new KryptosError("Key export failed [ x ]");
    }

    result.d = d;
    result.x = x;
  }

  if (!result.x.length) {
    if (!options.publicKey) {
      throw new KryptosError("Public key not available");
    }

    const keyObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
    const { crv, x } = keyObject.export({ format: "jwk" });

    if (crv !== options.curve) {
      throw new KryptosError("Key export failed [ crv ]");
    }
    if (!x) {
      throw new KryptosError("Key export failed [ x ]");
    }

    result.x = x;
  }

  if (!result.x.length) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};
