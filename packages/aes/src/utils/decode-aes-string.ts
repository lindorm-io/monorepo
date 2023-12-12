import { AesError } from "../errors";
import { BuildAesString } from "../types";

const regex = /(?<key>[a-z]+)=(?<value>.+)/g;

export const decodeAesString = (data: string): BuildAesString => {
  const [_, algorithm, array, iv, encryption, tag] = data.split("$");

  if (algorithm !== "aes-128-gcm" && algorithm !== "aes-192-gcm" && algorithm !== "aes-256-gcm") {
    throw new AesError("Invalid AES cipher string");
  }

  const items = array.split(",");
  const values: Record<string, string> = {};

  for (const item of items) {
    const match = new RegExp(regex).exec(item);

    if (!match?.groups?.key || !match?.groups?.value) {
      throw new AesError("Invalid AES cipher string");
    }

    values[match.groups.key] = match.groups.value;
  }

  const { cek, f: format, v } = values;

  if (format !== "base64" && format !== "hex") {
    throw new AesError("Invalid AES cipher string");
  }

  return {
    algorithm,
    authTag: Buffer.from(tag, format),
    encryption: Buffer.from(encryption, format),
    format,
    initialisationVector: Buffer.from(iv, format),
    publicEncryptionKey: cek ? Buffer.from(cek, format) : undefined,
    version: parseInt(v, 10),
  };
};
