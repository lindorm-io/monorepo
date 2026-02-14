import { generateKeyPair, generateKeyPairSync } from "crypto";
import { promisify } from "util";
import { KryptosAlgorithm } from "../../../types";
import { getRsaModulus } from "./get-modulus";

const generateKeyPairAsync = promisify(generateKeyPair);

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

export const generateRsaKeyAsync = async (options: Options): Promise<Result> => {
  const modulusLength = getRsaModulus(options);

  const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
    modulusLength,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey: privateKey, publicKey: publicKey };
};
