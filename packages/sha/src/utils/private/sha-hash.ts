import { createHash } from "crypto";
import { ShaError } from "../../errors";
import { CreateShaHashOptions, VerifyShaHashOptions } from "../../types";

export const createShaHash = ({
  algorithm = "SHA256",
  data,
  format = "base64",
}: CreateShaHashOptions): string => createHash(algorithm).update(data).digest(format);

export const verifyShaHash = ({ hash, ...options }: VerifyShaHashOptions): boolean =>
  createShaHash(options) === hash;

export const assertShaHash = (options: VerifyShaHashOptions): void => {
  if (verifyShaHash(options)) return;
  throw new ShaError("Hash does not match");
};
