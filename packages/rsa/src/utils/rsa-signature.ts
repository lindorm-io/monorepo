import { createSign, createVerify } from "crypto";
import { RsaAlgorithm, RsaFormat } from "../enums";
import { RsaError } from "../errors";
import { CreateRsaSignatureOptions, VerifyRsaSignatureOptions } from "../types";

export const createRsaSignature = ({
  algorithm = RsaAlgorithm.RS256,
  data,
  format = RsaFormat.BASE64,
  key,
}: CreateRsaSignatureOptions): string => {
  const sign = createSign(algorithm).update(data).end();
  return sign.sign(key, format);
};

export const verifyRsaSignature = ({
  algorithm = RsaAlgorithm.RS256,
  data,
  format = RsaFormat.BASE64,
  key,
  signature,
}: VerifyRsaSignatureOptions): boolean => {
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
  throw new RsaError("Invalid signature");
};
