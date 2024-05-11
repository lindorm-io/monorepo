import { createHash } from "crypto";
import { ShaError } from "../../errors";
import { CreateShaHashOptions, VerifyShaHashOptions } from "../../types";

export const _createShaHash = ({
  algorithm = "SHA256",
  data,
  format = "base64",
}: CreateShaHashOptions): string => createHash(algorithm).update(data).digest(format);

export const _verifyShaHash = ({ hash, ...options }: VerifyShaHashOptions): boolean =>
  _createShaHash(options) === hash;

export const _assertShaHash = (options: VerifyShaHashOptions): void => {
  if (_verifyShaHash(options)) return;
  throw new ShaError("Hash does not match");
};
