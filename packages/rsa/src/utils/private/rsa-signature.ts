import { Kryptos } from "@lindorm/kryptos";
import { createSign, createVerify } from "crypto";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../../types";

export const createRsaSignature = (options: CreateRsaSignatureOptions): string => {
  const { algorithm = "RSA-SHA256", data, format = "base64url", kryptos } = options;

  if (!Kryptos.isRsa(kryptos)) {
    throw new RsaError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new RsaError("Private key not found in key set");
  }

  const sign = createSign(algorithm).update(data).end();

  return sign.sign(privateKey, format);
};

export const verifyRsaSignature = (options: VerifyRsaSignatureOptions): boolean => {
  const { algorithm = "RSA-SHA256", data, format = "base64url", kryptos, signature } = options;

  if (!Kryptos.isRsa(kryptos)) {
    throw new RsaError("Invalid kryptos type");
  }

  const { publicKey } = kryptos.export("pem");

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
