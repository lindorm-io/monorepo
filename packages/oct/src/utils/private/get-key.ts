import { KryptosOct } from "@lindorm/kryptos";
import { OctError } from "../../errors";

export const _getPrivateKey = (kryptos: KryptosOct): string => {
  const { privateKey } = kryptos.export("b64");

  if (!privateKey) {
    throw new OctError("Missing private key");
  }

  return privateKey;
};
