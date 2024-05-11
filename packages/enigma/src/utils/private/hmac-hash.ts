import { createHmac } from "crypto";
import { HmacError } from "../../errors";
import { CreateHmacHashOptions, VerifyHmacHashOptions } from "../../types";

export const _createHmacHash = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  secret,
}: CreateHmacHashOptions): string => createHmac(algorithm, secret).update(data).digest(format);

export const _verifyHmacHash = ({
  algorithm = "SHA256",
  data,
  format = "base64",
  secret,
  hash,
}: VerifyHmacHashOptions): boolean => _createHmacHash({ algorithm, data, format, secret }) === hash;

export const _assertHmacHash = (options: VerifyHmacHashOptions): void => {
  if (_verifyHmacHash(options)) return;
  throw new HmacError("Hash does not match");
};
