import { B64 } from "@lindorm/b64";
import { AES_FORMAT_VERSION } from "../../constants/private";
import {
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../../types";
import {
  buildAesHeader,
  computeAad,
  decodeAesHeader,
  encodeAesHeader,
  headerToDecryptionParams,
} from "./aes-header";

/**
 * New serialised format (v1.0):
 *
 * {
 *   "header": "<base64url(JSON(metadata))>",
 *   "cek": "<base64url>",          // undefined for dir mode
 *   "iv": "<base64url>",
 *   "tag": "<base64url>",
 *   "ciphertext": "<base64url>",
 *   "v": "1.0"
 * }
 *
 * AAD = Buffer.from(record.header, "ascii") -- the base64url header string.
 */

export const createSerialisedAesRecord = (
  data: AesEncryptionRecord,
): SerialisedAesEncryption => {
  const header = buildAesHeader({
    algorithm: data.algorithm,
    contentType: data.contentType,
    encryption: data.encryption,
    keyId: data.keyId,
    pbkdfIterations: data.pbkdfIterations,
    pbkdfSalt: data.pbkdfSalt,
    publicEncryptionIv: data.publicEncryptionIv,
    publicEncryptionJwk: data.publicEncryptionJwk,
    publicEncryptionTag: data.publicEncryptionTag,
  });

  return {
    cek: data.publicEncryptionKey
      ? B64.encode(data.publicEncryptionKey, "b64u")
      : undefined,
    ciphertext: B64.encode(data.content, "b64u"),
    header: encodeAesHeader(header),
    iv: B64.encode(data.initialisationVector, "b64u"),
    tag: B64.encode(data.authTag, "b64u"),
    v: AES_FORMAT_VERSION,
  };
};

export const parseSerialisedAesRecord = (
  options: SerialisedAesDecryption,
): AesDecryptionRecord => {
  const header = decodeAesHeader(options.header);
  const params = headerToDecryptionParams(header);
  const aad = computeAad(options.header);

  return {
    ...params,
    aad,
    authTag: B64.toBuffer(options.tag, "b64u"),
    content: B64.toBuffer(options.ciphertext, "b64u"),
    initialisationVector: B64.toBuffer(options.iv, "b64u"),
    publicEncryptionKey: options.cek ? B64.toBuffer(options.cek, "b64u") : undefined,
  };
};
