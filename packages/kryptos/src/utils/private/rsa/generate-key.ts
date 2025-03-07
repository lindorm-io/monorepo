import { generateKeyPairSync } from "crypto";
import { KryptosAlgorithm } from "../../../types";
import { getRsaModulus } from "./get-modulus";

type Options = {
  algorithm: KryptosAlgorithm;
};

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateRsaKey = (options: Options): Result => {
  const modulusLength = getRsaModulus(options);

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey, publicKey };
};
