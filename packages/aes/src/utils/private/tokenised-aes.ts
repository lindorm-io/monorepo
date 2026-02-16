import { B64 } from "@lindorm/b64";
import { KryptosCurve, KryptosEncryption } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { removeEmpty } from "@lindorm/utils";
import { AesError } from "../../errors";
import { AesEncryptionRecord, ParsedAesDecryptionRecord } from "../../types";
import { AesStringValues } from "../../types/private";
import { validateAesVersion } from "./validate-version";

const regex = /(?<key>[a-z0-9]+)=(?<value>.+)/;

export const createTokenisedAesString = ({
  algorithm,
  authTag,
  content,
  contentType,
  encryption,
  initialisationVector,
  keyId,
  pbkdfIterations,
  pbkdfSalt,
  publicEncryptionIv,
  publicEncryptionJwk,
  publicEncryptionKey,
  publicEncryptionTag,
  version,
}: AesEncryptionRecord): string => {
  const values: AesStringValues = removeEmpty({
    v: version.toString(),
    kid: keyId,

    // Required
    alg: algorithm,
    cty: contentType,
    iv: B64.encode(initialisationVector, "b64u"),
    tag: B64.encode(authTag, "b64u"),

    // Key Derivation
    p2c: pbkdfIterations?.toString(),
    p2s: pbkdfSalt ? B64.encode(pbkdfSalt, "b64u") : undefined,

    // Public Encryption Key
    pei: publicEncryptionIv ? B64.encode(publicEncryptionIv, "b64u") : undefined,
    pek: publicEncryptionKey ? B64.encode(publicEncryptionKey, "b64u") : undefined,
    pet: publicEncryptionTag ? B64.encode(publicEncryptionTag, "b64u") : undefined,

    // Public JWK
    crv: publicEncryptionJwk?.crv,
    kty: publicEncryptionJwk?.kty,
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = B64.encode(content, "b64u");

  return `$${encryption}$${str}$${cnt}$`;
};

export const parseTokenisedAesString = (data: string): ParsedAesDecryptionRecord => {
  const [_, enc, array, content] = data.split("$");

  const encryption = enc as KryptosEncryption;
  const items = array.split(",");
  const values: Dict<string> = {};

  for (const item of items) {
    const match = regex.exec(item);

    if (!match?.groups?.key || !match?.groups?.value) {
      throw new AesError("Invalid AES cipher string", {
        debug: { item },
      });
    }

    values[match.groups.key] = match.groups.value;
  }

  const {
    v,
    kid,

    // Required
    alg,
    cty,
    iv,
    tag,

    // Key Derivation
    p2c,
    p2s,

    // Public Encryption Key
    pei,
    pek,
    pet,

    // Public JWK
    crv: curve,
    kty: keyType,
    x,
    y,
  } = values as unknown as AesStringValues;

  const crv = curve as KryptosCurve;
  const kty = keyType as "EC" | "OKP";

  const version = validateAesVersion(v);

  return {
    algorithm: alg,
    authTag: B64.toBuffer(tag, "b64u"),
    content: B64.toBuffer(content, "b64u"),
    contentType: cty,
    encryption: encryption,
    initialisationVector: B64.toBuffer(iv, "b64u"),
    keyId: kid,
    pbkdfIterations: p2c ? parseInt(p2c, 10) : undefined,
    pbkdfSalt: p2s ? B64.toBuffer(p2s, "b64u") : undefined,
    publicEncryptionIv: pei ? B64.toBuffer(pei, "b64u") : undefined,
    publicEncryptionJwk: crv && x && kty ? { crv, x, y, kty } : undefined,
    publicEncryptionKey: pek ? B64.toBuffer(pek, "b64u") : undefined,
    publicEncryptionTag: pet ? B64.toBuffer(pet, "b64u") : undefined,
    version,
  };
};
