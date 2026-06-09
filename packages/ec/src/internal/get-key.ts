import type { IKryptosEc } from "@lindorm/kryptos";
import { EcError } from "../errors/index.js";

export const getSignKey = (kryptos: IKryptosEc): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new EcError("Missing private key", {
      code: "private_key_not_found",
      title: "Private Key Not Found",
      details: "The EC key set does not contain a private key required for signing.",
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
      title: "Public Key Not Found",
      details: "The EC key set does not contain a public key required for verification.",
      data: { algorithm: kryptos.algorithm },
      debug: { id: kryptos.id },
    });
  }

  return publicKey;
};
