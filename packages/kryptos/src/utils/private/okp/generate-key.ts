import { generateKeyPairSync } from "crypto";
import { OkpCurve, OkpGenerate } from "../../../types";

type Result = {
  curve: OkpCurve;
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateOkpKey = (options: OkpGenerate): Result => {
  const curve = options.curve;

  const { privateKey, publicKey } = generateKeyPairSync(curve.toLowerCase() as any, {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { curve, privateKey, publicKey };
};
