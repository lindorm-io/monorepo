import { Kryptos } from "@lindorm/kryptos";
import { OctError } from "../../errors";

export const _getPrivateKey = (kryptos: Kryptos): string => {
  if (!Kryptos.isOct(kryptos)) {
    throw new OctError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new OctError("Missing private key");
  }

  return privateKey;
};
