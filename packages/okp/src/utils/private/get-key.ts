import { KryptosOkp } from "@lindorm/kryptos";
import { OkpError } from "../../errors";

export const _getSignKey = (kryptos: KryptosOkp): string => {
  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new OkpError("Missing private key");
  }

  return privateKey;
};

export const _getVerifyKey = (kryptos: KryptosOkp): string => {
  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new OkpError("Missing public key");
  }

  return publicKey;
};
