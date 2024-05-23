import { generateKeyPairSync } from "crypto";
import { EcCurve, EcGenerate } from "../../../types";
import { getEcCurve } from "./get-curve";

type Result = {
  curve: EcCurve;
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateEcKey = (options: EcGenerate): Result => {
  const curve = getEcCurve(options);

  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: curve,
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { curve, privateKey, publicKey };
};
