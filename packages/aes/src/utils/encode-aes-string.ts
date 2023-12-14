import { removeEmptyFromObject } from "@lindorm-io/core";
import { BuildAesString } from "../types";
import { mapFormatToShort } from "./private";

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
    f: mapFormatToShort(format),
    iv: initialisationVector.toString(format),
    tag: authTag.toString(format),
    cea: publicEncryptionKey ? "rsa-oaep" : undefined,
    cek: publicEncryptionKey?.toString(format),
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const enc = encryption.toString(format);

  return `\$${algorithm}\$${str}\$${enc}\$`;
};
