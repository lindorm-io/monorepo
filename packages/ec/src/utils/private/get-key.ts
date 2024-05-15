import { KryptosEc } from "@lindorm/kryptos";
import { EcError } from "../../errors";

export const _getSignKey = (kryptos: KryptosEc): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new EcError("Missing private key");
  }

  return privateKey;
};

export const _getVerifyKey = (kryptos: KryptosEc): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new EcError("Missing private key");
  }

  return publicKey;
};
