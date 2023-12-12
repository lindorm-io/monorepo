import { removeEmptyFromObject } from "@lindorm-io/core";
import { BuildAesString } from "../types";

export const encodeAesString = ({
  algorithm,
  authTag,
  encryption,
  format,
  initialisationVector,
  publicEncryptionKey,
  version,
}: BuildAesString): string => {
  const values = removeEmptyFromObject({
    v: version,
    f: format,
    cek: publicEncryptionKey?.toString(format),
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const iv = initialisationVector.toString(format);
  const enc = encryption.toString(format);
  const tag = authTag.toString(format);

  return `\$${algorithm}\$${str}\$${iv}\$${enc}\$${tag}\$`;
};
