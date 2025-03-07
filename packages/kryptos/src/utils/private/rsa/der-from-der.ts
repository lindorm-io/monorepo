import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosFromBuffer, RsaDer } from "../../../types";

type Options = Omit<KryptosFromBuffer, "algorithm" | "type" | "use">;

type Result = Omit<RsaDer, "algorithm" | "type" | "use">;

export const createRsaDerFromDer = (options: Options): Result => {
  const result: Result = {
    publicKey: Buffer.alloc(0),
  };

  if (options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs1",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "der", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "der", type: "pkcs1" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed");
    }
    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey.length) {
    const publicObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "pkcs1",
    });
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
