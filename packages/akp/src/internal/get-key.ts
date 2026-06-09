import type { IKryptosAkp } from "@lindorm/kryptos";
import { AkpError } from "../errors/index.js";

export const getSignKey = (kryptos: IKryptosAkp): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new AkpError("Missing private key", {
      code: "missing_private_key",
      title: "Missing Private Key",
      details: "The Kryptos instance has no private key, which is required for signing.",
    });
  }

  return privateKey;
};

export const getVerifyKey = (kryptos: IKryptosAkp): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new AkpError("Missing public key", {
      code: "missing_public_key",
      title: "Missing Public Key",
      details:
        "The Kryptos instance has no public key, which is required for verification.",
    });
  }

  return publicKey;
};
