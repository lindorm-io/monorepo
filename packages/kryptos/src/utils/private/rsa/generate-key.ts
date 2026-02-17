import { generateKeyPair, generateKeyPairSync } from "crypto";
import { promisify } from "util";
import { KryptosAlgorithm, RsaModulus } from "../../../types";
import { getRsaModulus } from "./get-modulus";

const generateKeyPairAsync = promisify(generateKeyPair);

type Options = {
  algorithm: KryptosAlgorithm;
};

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
  modulus: RsaModulus;
};

export const generateRsaKey = (options: Options): Result => {
  const modulus = getRsaModulus(options);

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: modulus,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey, publicKey, modulus };
};

export const generateRsaKeyAsync = async (options: Options): Promise<Result> => {
  const modulus = getRsaModulus(options);

  const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
    modulusLength: modulus,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey, publicKey, modulus };
};
