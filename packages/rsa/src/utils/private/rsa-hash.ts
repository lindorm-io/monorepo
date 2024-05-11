import { Kryptos } from "@lindorm/kryptos";
import { createSign, createVerify } from "crypto";
import { RsaError } from "../../errors";
import { CreateRsaHashOptions, VerifyRsaHashOptions } from "../../types";

export const _createRsaHash = ({
  algorithm = "RSA-SHA256",
  data,
  format = "base64url",
  kryptos,
}: CreateRsaHashOptions): string => {
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

export const _verifyRsaHash = ({
  algorithm = "RSA-SHA256",
  data,
  format = "base64url",
  kryptos,
  hash,
}: VerifyRsaHashOptions): boolean => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new RsaError("Invalid kryptos type");
  }

  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new RsaError("Public key not found in key set");
  }

  const verifier = createVerify(algorithm).update(data).end();

  return verifier.verify(publicKey, hash, format);
};

export const _assertRsaHash = (options: VerifyRsaHashOptions): void => {
  if (_verifyRsaHash(options)) return;
  throw new RsaError("Invalid hash");
};
