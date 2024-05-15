import { generateKeyPair as _generateKeyPair } from "crypto";
import { promisify } from "util";
import { EcGenerate } from "../../../types";

const generateKeyPair = promisify(_generateKeyPair);

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateEcKey = async (options: EcGenerate): Promise<Result> => {
  const { privateKey, publicKey } = await generateKeyPair("ec", {
    namedCurve: options.curve,
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { privateKey, publicKey };
};
