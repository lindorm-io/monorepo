import { KryptosCurve } from "@lindorm/kryptos";
import { BufferFormat, ShaAlgorithm } from "@lindorm/types";
import { AesError } from "../../errors";
import { AesEncryption, AesEncryptionData, AesEncryptionKeyAlgorithm } from "../../types";
import { AesStringValues } from "../../types/private";

const regex = /(?<key>[a-z0-9]+)=(?<value>.+)/g;

export const _decodeAesString = (data: string): AesEncryptionData => {
  const [_, alg, array, content] = data.split("$");

  const algorithm = alg as AesEncryption;
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
    crv: curve,
    eka,
    hks,
    ih,
    iv,
    kid,
    kty: keyType,
    p2c,
    p2s,
    pek,
    tag,
    x,
    y,
  } = values as unknown as AesStringValues;

  const crv = curve as KryptosCurve;
  const format = f as BufferFormat;
  const kty = keyType as "EC" | "OKP";

  return {
    authTag: tag ? Buffer.from(tag, format) : undefined,
    content: Buffer.from(content, format),
    encryption: algorithm,
    encryptionKeyAlgorithm: eka as AesEncryptionKeyAlgorithm,
    format,
    hkdfSalt: hks ? Buffer.from(hks, format) : undefined,
    initialisationVector: Buffer.from(iv, format),
    integrityHash: ih as ShaAlgorithm,
    keyId: kid ? Buffer.from(kid, format) : undefined,
    pbkdfIterations: p2c ? parseInt(p2c, 10) : undefined,
    pbkdfSalt: p2s ? Buffer.from(p2s, format) : undefined,
    publicEncryptionJwk: crv && x && kty ? { crv, x, y, kty } : undefined,
    publicEncryptionKey: pek ? Buffer.from(pek, format) : undefined,
    version: parseInt(v, 10),
  };
};
