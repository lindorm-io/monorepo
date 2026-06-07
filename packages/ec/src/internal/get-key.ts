import type { IKryptosEc } from "@lindorm/kryptos";
import { EcError } from "../errors/index.js";

export const getSignKey = (kryptos: IKryptosEc): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new EcError("Missing private key", {
      code: "private_key_not_found",
      data: { algorithm: kryptos.algorithm },
      debug: { id: kryptos.id },
    });
  }

  return privateKey;
};

export const getVerifyKey = (kryptos: IKryptosEc): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new EcError("Missing public key", {
      code: "public_key_not_found",
      data: { algorithm: kryptos.algorithm },
      debug: { id: kryptos.id },
    });
  }

  return publicKey;
};
