import { generateKeyPairSync } from "crypto";
import { EcCurve, KryptosAlgorithm, KryptosCurve } from "../../../types";
import { getEcCurve } from "./get-curve";

type Options = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve | null;
};

type Result = {
  curve: EcCurve;
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateEcKey = (options: Options): Result => {
  const curve = getEcCurve(options);

  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: curve,
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { curve, privateKey, publicKey };
};
