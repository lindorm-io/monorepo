import { createSign, createVerify } from "crypto";
import { RsaError } from "../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../types";
import { getKeySet } from "./private";

export const createRsaSignature = (options: CreateRsaSignatureOptions): string => {
  const { algorithm = "RSA-SHA256", data, format = "base64url" } = options;

  const keySet = getKeySet(options);
  const { privateKey } = keySet.export("pem");

  if (!privateKey) {
    throw new RsaError("Private key not found in key set");
  }

  const sign = createSign(algorithm).update(data).end();
  return sign.sign(privateKey, format);
};

export const verifyRsaSignature = (options: VerifyRsaSignatureOptions): boolean => {
  const { algorithm = "RSA-SHA256", data, format = "base64url", signature } = options;

  const keySet = getKeySet(options);
  const { publicKey } = keySet.export("pem");

  if (!publicKey) {
    throw new RsaError("Public key not found in key set");
  }

  const verifier = createVerify(algorithm).update(data).end();
  return verifier.verify(publicKey, signature, format);
};

export const assertRsaSignature = (options: VerifyRsaSignatureOptions): void => {
  if (verifyRsaSignature(options)) return;
  throw new RsaError("Invalid signature");
};
