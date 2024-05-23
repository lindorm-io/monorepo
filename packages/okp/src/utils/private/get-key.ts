import { IKryptosOkp } from "@lindorm/kryptos";
import { OkpError } from "../../errors";

export const getSignKey = (kryptos: IKryptosOkp): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new OkpError("Missing private key");
  }

  return privateKey;
};

export const getVerifyKey = (kryptos: IKryptosOkp): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new OkpError("Missing public key");
  }

  return publicKey;
};
