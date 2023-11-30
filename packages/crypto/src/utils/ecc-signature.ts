import { createSign, createVerify } from "crypto";
import { CryptoError } from "../error";
import { CreateEccSignatureOptions, VerifyEccSignatureOptions } from "../types";

const assertAlgorithm = (algorithm: string): void => {
  if (["SHA256", "SHA384", "SHA512"].includes(algorithm)) {
    return;
  }
  throw new CryptoError("Invalid algorithm", {
    debug: { algorithm },
    description: "Algorithm not supported",
    data: { supported: ["SHA256", "SHA384", "SHA512"] },
  });
};

export const createEccSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  key,
}: CreateEccSignatureOptions): string => {
  assertAlgorithm(algorithm);
  const sign = createSign(algorithm).update(data).end();
  return sign.sign(key, format);
};

export const verifyEccSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  key,
  signature,
}: VerifyEccSignatureOptions): boolean => {
  assertAlgorithm(algorithm);
  const verifier = createVerify(algorithm).update(data).end();
  return verifier.verify(key, signature, format);
};

export const assertEccSignature = ({
  algorithm,
  data,
  format,
  key,
  signature,
}: VerifyEccSignatureOptions): void => {
  if (verifyEccSignature({ algorithm, data, format, key, signature })) return;
  throw new CryptoError("Invalid signature");
};
