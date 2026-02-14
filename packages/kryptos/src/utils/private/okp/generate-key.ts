import { generateKeyPair, generateKeyPairSync } from "crypto";
import { promisify } from "util";
import { KryptosAlgorithm, KryptosCurve, OkpCurve } from "../../../types";
import { getOkpCurve } from "./get-curve";

const generateKeyPairAsync = promisify(generateKeyPair);

type NodeOkpCurve = "ed25519" | "ed448" | "x25519" | "x448";

const NODE_OKP_CURVES: Record<OkpCurve, NodeOkpCurve> = {
  Ed25519: "ed25519",
  Ed448: "ed448",
  X25519: "x25519",
  X448: "x448",
};

type Options = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve | null;
};

type Result = {
  curve: OkpCurve;
  privateKey: Buffer;
  publicKey: Buffer;
};

export const generateOkpKey = (options: Options): Result => {
  const curve = getOkpCurve(options);

  // TS can't resolve union types against generateKeyPairSync overloads;
  // NODE_OKP_CURVES guarantees the value is a valid OKP curve at compile time
  const nodeCurve: "ed25519" = NODE_OKP_CURVES[curve] as "ed25519";
  const { privateKey, publicKey } = generateKeyPairSync(nodeCurve, {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { curve, privateKey, publicKey };
};

export const generateOkpKeyAsync = async (options: Options): Promise<Result> => {
  const curve = getOkpCurve(options);

  // TS can't resolve union types against generateKeyPair overloads;
  // NODE_OKP_CURVES guarantees the value is a valid OKP curve at compile time
  const nodeCurve: "ed25519" = NODE_OKP_CURVES[curve] as "ed25519";
  const { privateKey, publicKey } = await generateKeyPairAsync(nodeCurve, {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { curve, privateKey: privateKey, publicKey: publicKey };
};
