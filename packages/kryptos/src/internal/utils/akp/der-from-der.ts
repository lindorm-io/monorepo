import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { AkpBuffer, KryptosFromBuffer } from "../../../types";

type Options = Omit<KryptosFromBuffer, "id" | "algorithm" | "type" | "use">;

type Result = Omit<AkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createAkpDerFromDer = (options: Options): Result => {
  const result: Result = {
    publicKey: Buffer.alloc(0),
  };

  if (options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs8",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey?.length) {
    const publicObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
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
