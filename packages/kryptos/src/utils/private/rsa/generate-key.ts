import { generateKeyPairSync } from "crypto";
import { RsaGenerate } from "../../../types";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateRsaKey = (options: RsaGenerate): Result => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: options.size * 1024,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey, publicKey };
};
