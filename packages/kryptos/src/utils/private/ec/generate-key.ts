import { generateKeyPairSync } from "crypto";
import { EcGenerate } from "../../../types";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateEcKey = (options: EcGenerate): Result => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: options.curve,
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { privateKey, publicKey };
};
