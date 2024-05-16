import { generateKeyPairSync } from "crypto";
import { OkpGenerate } from "../../../types";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateOkpKey = (options: OkpGenerate): Result => {
  const { privateKey, publicKey } = generateKeyPairSync(
    options.curve.toLowerCase() as any,
    {
      privateKeyEncoding: { format: "der", type: "pkcs8" },
      publicKeyEncoding: { format: "der", type: "spki" },
    },
  );

  return { privateKey, publicKey };
};
