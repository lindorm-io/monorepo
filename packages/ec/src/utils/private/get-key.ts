import { IKryptosEc } from "@lindorm/kryptos";
import { EcError } from "../../errors";

export const _getSignKey = (kryptos: IKryptosEc): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new EcError("Missing private key");
  }

  return privateKey;
};

export const _getVerifyKey = (kryptos: IKryptosEc): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new EcError("Missing private key");
  }

  return publicKey;
};
