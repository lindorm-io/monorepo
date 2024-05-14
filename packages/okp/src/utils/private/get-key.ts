import { Kryptos } from "@lindorm/kryptos";
import { OkpError } from "../../errors";

export const _getSignKey = (kryptos: Kryptos): string => {
  if (!Kryptos.isOkp(kryptos)) {
    throw new OkpError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new OkpError("Missing private key");
  }

  return privateKey;
};

export const _getVerifyKey = (kryptos: Kryptos): string => {
  if (!Kryptos.isOkp(kryptos)) {
    throw new OkpError("Invalid kryptos type");
  }

  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new OkpError("Missing public key");
  }

  return publicKey;
};
