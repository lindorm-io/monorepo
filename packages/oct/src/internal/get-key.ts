import type { IKryptosOct } from "@lindorm/kryptos";
import { OctError } from "../errors/index.js";

export const getPrivateKey = (kryptos: IKryptosOct): Buffer => {
  const { privateKey } = kryptos.export("der");

  if (!privateKey) {
    throw new OctError("Missing private key", {
      code: "private_key_not_found",
      title: "Private Key Not Found",
      details: "The oct key set does not contain a secret key required for signing.",
      data: { algorithm: kryptos.algorithm },
      debug: { id: kryptos.id },
    });
  }

  return privateKey;
};
