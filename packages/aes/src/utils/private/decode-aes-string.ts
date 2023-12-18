import { mapShortToFormat, mapStringToEncryptionKeyAlgorithm } from ".";
import { AesError } from "../../errors";
import { AesEncryptionData } from "../../types";

const regex = /(?<key>[a-z]+)=(?<value>.+)/g;

export const decodeAesString = (data: string): AesEncryptionData => {
  const [_, algorithm, array, content] = data.split("$");

  if (
    algorithm !== "aes-128-cbc" &&
    algorithm !== "aes-192-cbc" &&
    algorithm !== "aes-256-cbc" &&
    algorithm !== "aes-128-gcm" &&
    algorithm !== "aes-192-gcm" &&
    algorithm !== "aes-256-gcm"
  ) {
    throw new AesError("Invalid AES cipher string", {
      description: "Invalid algorithm header",
      debug: { algorithm },
    });
  }

  const items = array.split(",");
  const values: Record<string, string> = {};

  for (const item of items) {
    const match = new RegExp(regex).exec(item);

    if (!match?.groups?.key || !match?.groups?.value) {
      throw new AesError("Invalid AES cipher string", {
        description: "Invalid key/value pair",
        debug: { item },
      });
    }

    values[match.groups.key] = match.groups.value;
  }

  const { cek, eka, f, iv, kid, tag, v } = values;
  const format = mapShortToFormat(f);

  return {
    algorithm,
    authTag: tag ? Buffer.from(tag, format) : undefined,
    content: Buffer.from(content, format),
    encryptionKeyAlgorithm: eka ? mapStringToEncryptionKeyAlgorithm(eka) : undefined,
    format,
    initialisationVector: Buffer.from(iv, format),
    keyId: kid ? Buffer.from(kid, format) : undefined,
    publicEncryptionKey: cek ? Buffer.from(cek, format) : undefined,
    version: parseInt(v, 10),
  };
};
