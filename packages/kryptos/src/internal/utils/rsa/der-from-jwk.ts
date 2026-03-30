import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosFromJwk, RsaBuffer } from "../../../types";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<RsaBuffer, "id" | "algorithm" | "type" | "use">;

export const createRsaDerFromJwk = (options: Options): Result => {
  const result: Result = {
    publicKey: Buffer.alloc(0),
  };

  if (options.d && options.dp && options.dq && options.p && options.q && options.qi) {
    const privateObject = createPrivateKey({
      key: options,
      format: "jwk",
      type: "pkcs1",
    });
    const privateKey = privateObject.export({ format: "der", type: "pkcs1" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.e && options.n) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

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
