import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { AkpBuffer, KryptosFromJwk } from "../../../types/index.js";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<AkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createAkpDerFromJwk = (options: Options): Result => {
  if (!options.pub) {
    throw new KryptosError("Missing public key component [pub]");
  }

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
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.pub) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};
