import { removeEmptyFromObject } from "@lindorm-io/core";
import { mapFormatToShort } from ".";
import { BuildAesString } from "../../types";

export const encodeAesString = ({
  algorithm,
  authTag,
  encryption,
  format,
  initialisationVector,
  keyId,
  publicEncryptionKey,
  version,
}: BuildAesString): string => {
  const values = removeEmptyFromObject({
    v: version,
    f: mapFormatToShort(format),
    cek: publicEncryptionKey?.toString(format),
    iv: initialisationVector.toString(format),
    kid: publicEncryptionKey && keyId ? keyId.toString(format) : undefined,
    pka: publicEncryptionKey ? "rsa-oaep" : undefined,
    tag: authTag.toString(format),
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const enc = encryption.toString(format);

  return `\$${algorithm}\$${str}\$${enc}\$`;
};
