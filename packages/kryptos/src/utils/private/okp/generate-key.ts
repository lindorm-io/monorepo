import { generateKeyPair as _generateKeyPair } from "crypto";
import { promisify } from "util";
import { OkpGenerate } from "../../../types";

const generateKeyPair = promisify(_generateKeyPair);

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

export const _generateOkpKey = async (options: OkpGenerate): Promise<Result> => {
  const { privateKey, publicKey } = await generateKeyPair(
    options.curve.toLowerCase() as any,
    {
      privateKeyEncoding: { format: "der", type: "pkcs8" },
      publicKeyEncoding: { format: "der", type: "spki" },
    },
  );

  return { privateKey, publicKey };
};
