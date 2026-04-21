import { generateKeyPair, generateKeyPairSync } from "crypto";
import { promisify } from "util";
import { KryptosError } from "../../../errors/index.js";
import type { AkpAlgorithm, KryptosAlgorithm } from "../../../types/index.js";

const generateKeyPairAsync = promisify(generateKeyPair);

type NodeMlDsaVariant = "ml-dsa-44" | "ml-dsa-65" | "ml-dsa-87";

const ML_DSA_VARIANT: Record<AkpAlgorithm, NodeMlDsaVariant> = {
  "ML-DSA-44": "ml-dsa-44",
  "ML-DSA-65": "ml-dsa-65",
  "ML-DSA-87": "ml-dsa-87",
};

type Options = {
  algorithm: KryptosAlgorithm;
};

type Result = {
  privateKey: Buffer;
  publicKey: Buffer;
};

const resolveVariant = (algorithm: KryptosAlgorithm): NodeMlDsaVariant => {
  const variant = ML_DSA_VARIANT[algorithm as AkpAlgorithm];

  if (!variant) {
    throw new KryptosError(`Unsupported AKP algorithm: ${algorithm}`);
  }

  return variant;
};

export const generateAkpKey = (options: Options): Result => {
  const variant = resolveVariant(options.algorithm);

  // TS can't resolve union types against generateKeyPairSync overloads;
  // ML_DSA_VARIANT guarantees the value is a valid ML-DSA variant at compile time
  const nodeKind: "ml-dsa-65" = variant as "ml-dsa-65";
  const { privateKey, publicKey } = generateKeyPairSync(nodeKind, {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { privateKey, publicKey };
};

export const generateAkpKeyAsync = async (options: Options): Promise<Result> => {
  const variant = resolveVariant(options.algorithm);

  // TS can't resolve union types against generateKeyPair overloads;
  // ML_DSA_VARIANT guarantees the value is a valid ML-DSA variant at compile time
  const nodeKind: "ml-dsa-65" = variant as "ml-dsa-65";
  const { privateKey, publicKey } = await generateKeyPairAsync(nodeKind, {
    privateKeyEncoding: { format: "der", type: "pkcs8" },
    publicKeyEncoding: { format: "der", type: "spki" },
  });

  return { privateKey, publicKey };
};
