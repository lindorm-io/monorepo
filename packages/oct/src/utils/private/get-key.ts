import { IKryptosOct } from "@lindorm/kryptos";
import { OctError } from "../../errors";

export const _getPrivateKey = (kryptos: IKryptosOct): string => {
  const { privateKey } = kryptos.export("b64");

  if (!privateKey) {
    throw new OctError("Missing private key");
  }

  return privateKey;
};
