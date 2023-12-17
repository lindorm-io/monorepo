import { AesError } from "../errors";
import { BuildAesString } from "../types";
import { mapShortToFormat } from "./private";

const regex = /(?<key>[a-z]+)=(?<value>.+)/g;

export const decodeAesString = (data: string): BuildAesString => {
  const [_, algorithm, array, encryption] = data.split("$");

  if (algorithm !== "aes-128-gcm" && algorithm !== "aes-192-gcm" && algorithm !== "aes-256-gcm") {
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

  const { cek, f, iv, kid, pka, tag, v } = values;
  const format = mapShortToFormat(f);

  if (cek && pka !== "rsa-oaep") {
    throw new AesError("Invalid AES cipher string", {
      description: "Invalid RSA encryption algorithm",
      debug: { pka },
    });
  }

  return {
    algorithm,
    authTag: Buffer.from(tag, format),
    encryption: Buffer.from(encryption, format),
    format,
    initialisationVector: Buffer.from(iv, format),
    keyId: kid ? Buffer.from(kid, format) : undefined,
    publicEncryptionKey: cek ? Buffer.from(cek, format) : undefined,
    version: parseInt(v, 10),
  };
};
