import type { IKryptosAkp } from "@lindorm/kryptos";
import { AkpError } from "../errors/index.js";

export const getSignKey = (kryptos: IKryptosAkp): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new AkpError("Missing private key", { code: "missing_private_key" });
  }

  return privateKey;
};

export const getVerifyKey = (kryptos: IKryptosAkp): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new AkpError("Missing public key", { code: "missing_public_key" });
  }

  return publicKey;
};
