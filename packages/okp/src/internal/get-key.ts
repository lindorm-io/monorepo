import type { IKryptosOkp } from "@lindorm/kryptos";
import { OkpError } from "../errors/index.js";

export const getSignKey = (kryptos: IKryptosOkp): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new OkpError("Missing private key", {
      code: "missing_private_key",
      title: "Missing Private Key",
      details:
        "The Kryptos instance does not contain a private key required for signing.",
    });
  }

  return privateKey;
};

export const getVerifyKey = (kryptos: IKryptosOkp): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new OkpError("Missing public key", {
      code: "missing_public_key",
      title: "Missing Public Key",
      details:
        "The Kryptos instance does not contain a public key required for verification.",
    });
  }

  return publicKey;
};
