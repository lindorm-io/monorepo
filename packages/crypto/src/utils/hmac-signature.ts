import { createHmac } from "crypto";
import { CryptoError } from "../errors";
import { CreateHmacSignatureOptions, VerifyHmacSignatureOptions } from "../types";

export const createHmacSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  secret,
}: CreateHmacSignatureOptions): string => createHmac(algorithm, secret).update(data).digest(format);

export const verifyHmacSignature = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  secret,
  signature,
}: VerifyHmacSignatureOptions): boolean =>
  createHmacSignature({ algorithm, data, format, secret }) === signature;

export const assertHmacSignature = ({
  algorithm,
  data,
  format,
  secret,
  signature,
}: VerifyHmacSignatureOptions): void => {
  if (verifyHmacSignature({ algorithm, data, format, secret, signature })) return;
  throw new CryptoError("Hash does not match");
};
