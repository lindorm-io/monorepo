import { isString } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosBuffer, RsaString } from "../../../types";

type Options = Omit<KryptosBuffer, "algorithm" | "type" | "use">;

type Result = Omit<RsaString, "algorithm" | "type" | "use">;

export const exportRsaToPem = (options: Options): Result => {
  const result: Result = {
    publicKey: "",
  };

  if (options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs1",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "pem", type: "pkcs1" });
    const publicKey = publicObject.export({ format: "pem", type: "pkcs1" });

    if (!isString(privateKey)) {
      throw new KryptosError("Key export failed [ private ]");
    }
    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [ public ]");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey) {
    if (!options.publicKey) {
      throw new KryptosError("Public key is required");
    }

    const publicObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "pkcs1",
    });
    const publicKey = publicObject.export({ format: "pem", type: "pkcs1" });

    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [ public ]");
    }

    result.publicKey = publicKey;
  }

  if (!result.publicKey.length) {
    throw new KryptosError("Key export failed ");
  }

  return result;
};
