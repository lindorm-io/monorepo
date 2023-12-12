import { createHash } from "crypto";
import { CryptoError } from "../errors";
import { CreateShaHashOptions, VerifyShaHashOptions } from "../types";

export const createShaHash = ({
  algorithm = "SHA256",
  data,
  format = "base64",
}: CreateShaHashOptions): string => createHash(algorithm).update(data).digest(format);

export const verifyShaHash = ({ algorithm, data, format, hash }: VerifyShaHashOptions): boolean =>
  createShaHash({ algorithm, data, format }) === hash;

export const assertShaHash = ({ algorithm, data, format, hash }: VerifyShaHashOptions): void => {
  if (verifyShaHash({ algorithm, data, format, hash })) return;
  throw new CryptoError("Hash does not match");
};
