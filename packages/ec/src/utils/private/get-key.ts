import { Kryptos } from "@lindorm/kryptos";
import { EcError } from "../../errors";

export const _getSignKey = (kryptos: Kryptos): string => {
  if (!Kryptos.isEc(kryptos)) {
    throw new EcError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new EcError("Missing private key");
  }

  return privateKey;
};

export const _getVerifyKey = (kryptos: Kryptos): string => {
  if (!Kryptos.isEc(kryptos)) {
    throw new EcError("Invalid kryptos type");
  }

  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new EcError("Missing private key");
  }

  return publicKey;
};
