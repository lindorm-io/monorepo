import { KryptosAlgorithm, KryptosCurve, KryptosEncryption } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { AesError } from "../../errors";
import { AesEncryptionData } from "../../types";
import { AesStringValues } from "../../types/private";

const regex = /(?<key>[a-z0-9]+)=(?<value>.+)/g;

export const _decodeAesString = (data: string): AesEncryptionData => {
  const [_, enc, array, content] = data.split("$");

  const encryption = enc as KryptosEncryption;
  const items = array.split(",");
  const values: Record<string, string> = {};

  for (const item of items) {
    const match = new RegExp(regex).exec(item);

    if (!match?.groups?.key || !match?.groups?.value) {
      throw new AesError("Invalid AES cipher string", {
        debug: { item },
      });
    }

    values[match.groups.key] = match.groups.value;
  }

  const {
    v,
    f,

    // Required
    alg,
    iv,
    kid,
    tag,

    // Optional
    hks,
    p2c,
    p2s,
    pek,

    // Public JWK
    crv: curve,
    kty: keyType,
    x,
    y,
  } = values as unknown as AesStringValues;

  const crv = curve as KryptosCurve;
  const format = f as BufferFormat;
  const kty = keyType as "EC" | "OKP";

  return {
    authTag: Buffer.from(tag, format),
    content: Buffer.from(content, format),
    encryption: encryption,
    algorithm: alg as KryptosAlgorithm,
    format,
    hkdfSalt: hks ? Buffer.from(hks, format) : undefined,
    initialisationVector: Buffer.from(iv, format),
    keyId: Buffer.from(kid, format),
    pbkdfIterations: p2c ? parseInt(p2c, 10) : undefined,
    pbkdfSalt: p2s ? Buffer.from(p2s, format) : undefined,
    publicEncryptionJwk: crv && x && kty ? { crv, x, y, kty } : undefined,
    publicEncryptionKey: pek ? Buffer.from(pek, format) : undefined,
    version: parseInt(v, 10),
  };
};
