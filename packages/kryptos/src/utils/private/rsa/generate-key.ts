import { generateKeyPair as _generateKeyPair } from "crypto";
import { promisify } from "util";
import { RsaGenerate } from "../../../types";

const generateKeyPair = promisify(_generateKeyPair);

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateRsaKey = async (options: RsaGenerate): Promise<Result> => {
  const { privateKey, publicKey } = await generateKeyPair("rsa", {
    modulusLength: options.size * 1024,
    publicKeyEncoding: { format: "der", type: "pkcs1" },
    privateKeyEncoding: { format: "der", type: "pkcs1" },
  });

  return { privateKey, publicKey };
};
