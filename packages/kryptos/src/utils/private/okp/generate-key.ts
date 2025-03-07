import { generateKeyPairSync } from "crypto";
import { KryptosAlgorithm, KryptosCurve, OkpCurve } from "../../../types";
import { getOkpCurve } from "./get-curve";

type Options = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
};

type Result = {
  curve: OkpCurve;
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateOkpKey = (options: Options): Result => {
  const curve = getOkpCurve(options);

  const { privateKey, publicKey } = generateKeyPairSync(curve.toLowerCase() as any, {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { curve, privateKey, publicKey };
};
