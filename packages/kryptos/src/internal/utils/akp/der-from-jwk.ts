import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { AkpBuffer, AkpJwk, KryptosFromJwk } from "../../../types/index.js";
import { assertAkpJwk } from "./assert-jwk.js";

type Options = Omit<KryptosFromJwk, "kid" | "use">;

type Result = Omit<AkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createAkpDerFromJwk = (options: Options): Result => {
  if (!options.pub) {
    throw new KryptosError("Missing public key component [pub]", {
      code: "missing_akp_jwk_component",
      title: "Missing AKP JWK Component",
      details: "The provided JWK was missing its required 'pub' component.",
    });
  }

  assertAkpJwk(options as AkpJwk);

  const result: Result = {
    publicKey: Buffer.alloc(0),
  };

  if (options.priv && options.pub) {
    const privateObject = createPrivateKey({
      key: options,
      format: "jwk",
      type: "pkcs8",
    });
    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed", {
        code: "akp_der_export_failed",
        title: "AKP DER Export Failed",
        details:
          "Exporting the private key from JWK to PKCS8 DER did not return a Buffer.",
      });
    }

    result.privateKey = privateKey;
  }

  if (options.pub) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "akp_der_export_failed",
        title: "AKP DER Export Failed",
        details: "Exporting the public key from JWK to SPKI DER did not return a Buffer.",
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed", {
      code: "missing_akp_key_material",
      title: "Missing AKP Key Material",
      details: "The JWK yielded neither a usable private key nor public key.",
    });
  }

  return result;
};
