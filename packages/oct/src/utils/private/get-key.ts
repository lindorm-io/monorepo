import { IKryptosOct } from "@lindorm/kryptos";
import { OctError } from "../../errors";

export const _getPrivateKey = (kryptos: IKryptosOct): Buffer => {
  const { privateKey } = kryptos.export("der");

  if (!privateKey) {
    throw new OctError("Missing private key");
  }

  return privateKey;
};
