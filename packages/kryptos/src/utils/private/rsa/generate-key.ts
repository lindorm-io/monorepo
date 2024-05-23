import { generateKeyPairSync } from "crypto";
import { RsaGenerate } from "../../../types";
import { getRsaModulus } from "./get-modulus";

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateRsaKey = (options: RsaGenerate): Result => {
  const modulusLength = getRsaModulus(options);

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey, publicKey };
};
