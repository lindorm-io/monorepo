import { Kryptos } from "@lindorm/kryptos";
import { createSign, createVerify } from "crypto";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../../types";

export const _createRsaSignature = ({
  algorithm = "RSA-SHA256",
  data,
  format = "base64url",
  kryptos,
}: CreateRsaSignatureOptions): string => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new RsaError("Invalid kryptos type");
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new RsaError("Private key not found in key set");
  }

  return createSign(algorithm).update(data).end().sign(privateKey, format);
};

export const _verifyRsaSignature = ({
  algorithm = "RSA-SHA256",
  data,
  format = "base64url",
  kryptos,
  signature,
}: VerifyRsaSignatureOptions): boolean => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new RsaError("Invalid kryptos type");
  }

  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new RsaError("Public key not found in key set");
  }

  return createVerify(algorithm).update(data).end().verify(publicKey, signature, format);
};

export const _assertRsaSignature = (options: VerifyRsaSignatureOptions): void => {
  if (_verifyRsaSignature(options)) return;
  throw new RsaError("Invalid signature");
};
