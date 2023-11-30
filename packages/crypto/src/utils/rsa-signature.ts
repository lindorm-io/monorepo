import { createSign, createVerify } from "crypto";
import { CryptoError } from "../error";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../types";

const SUPPORTED_ALGS = ["RSA-SHA256", "RSA-SHA384", "RSA-SHA512", "SHA256", "SHA384", "SHA512"];

const assertAlgorithm = (algorithm: string): void => {
  if (SUPPORTED_ALGS.includes(algorithm)) return;
  throw new CryptoError("Invalid algorithm", {
    debug: { algorithm },
    description: "Algorithm not supported",
    data: {
      supportedAlgorithms: SUPPORTED_ALGS,
    },
  });
};

export const createRsaSignature = ({
  algorithm = "RSA-SHA256",
  data,
  format = "base64",
  key,
}: CreateRsaSignatureOptions): string => {
  assertAlgorithm(algorithm);
  const sign = createSign(algorithm).update(data).end();
  return sign.sign(key, format);
};

export const verifyRsaSignature = ({
  algorithm = "RSA-SHA256",
  data,
  format = "base64",
  key,
  signature,
}: VerifyRsaSignatureOptions): boolean => {
  assertAlgorithm(algorithm);
  const verifier = createVerify(algorithm).update(data).end();
  return verifier.verify(key, signature, format);
};

export const assertRsaSignature = ({
  algorithm,
  data,
  format,
  key,
  signature,
}: VerifyRsaSignatureOptions): void => {
  if (verifyRsaSignature({ algorithm, data, format, key, signature })) return;
  throw new CryptoError("Invalid signature");
};
