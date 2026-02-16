import { B64 } from "@lindorm/b64";
import { AesError } from "../../errors";
import { AesEncryptionRecord, ParsedAesDecryptionRecord } from "../../types";
import {
  buildAesHeader,
  computeAad,
  decodeAesHeader,
  encodeAesHeader,
  headerToDecryptionParams,
} from "./aes-header";

/**
 * New tokenised format (v1.0):
 *
 * With CEK (key-wrap modes):
 *   aes:<base64url(JSON(header))>$<base64url(cek)>$<base64url(iv)>$<base64url(tag)>$<base64url(ciphertext)>
 *
 * Without CEK (dir mode):
 *   aes:<base64url(JSON(header))>$<base64url(iv)>$<base64url(tag)>$<base64url(ciphertext)>
 *
 * Detection: string.startsWith("aes:")
 * AAD = the base64url header segment (between ":" and first "$")
 */

export const createTokenisedAesString = (data: AesEncryptionRecord): string => {
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

  const headerB64 = encodeAesHeader(header);
  const ivB64 = B64.encode(data.initialisationVector, "b64u");
  const tagB64 = B64.encode(data.authTag, "b64u");
  const ciphertextB64 = B64.encode(data.content, "b64u");

  if (data.publicEncryptionKey) {
    const cekB64 = B64.encode(data.publicEncryptionKey, "b64u");
    return `aes:${headerB64}$${cekB64}$${ivB64}$${tagB64}$${ciphertextB64}`;
  }

  return `aes:${headerB64}$${ivB64}$${tagB64}$${ciphertextB64}`;
};

export const parseTokenisedAesString = (data: string): ParsedAesDecryptionRecord => {
  if (!data.startsWith("aes:")) {
    throw new AesError("Invalid tokenised AES string: must start with 'aes:'");
  }

  const withoutPrefix = data.slice(4); // Remove "aes:"
  const parts = withoutPrefix.split("$");

  if (parts.length < 4 || parts.length > 5) {
    throw new AesError("Invalid tokenised AES string: unexpected number of segments", {
      debug: { segmentCount: parts.length },
    });
  }

  const headerB64 = parts[0];
  const header = decodeAesHeader(headerB64);
  const params = headerToDecryptionParams(header);
  const aad = computeAad(headerB64);

  // Determine if CEK is present based on algorithm
  // "dir" and "ECDH-ES" have no wrapped CEK
  const isDirect = header.alg === "dir" || header.alg === "ECDH-ES";
  const hasCek = parts.length === 5;

  if (isDirect && hasCek) {
    throw new AesError(
      "Invalid tokenised AES string: dir/ECDH-ES must not have CEK segment",
    );
  }

  if (!isDirect && !hasCek) {
    throw new AesError(
      "Invalid tokenised AES string: non-dir algorithm must have CEK segment",
    );
  }

  let publicEncryptionKey: Buffer | undefined;
  let ivB64: string;
  let tagB64: string;
  let ciphertextB64: string;

  if (hasCek) {
    publicEncryptionKey = B64.toBuffer(parts[1], "b64u");
    ivB64 = parts[2];
    tagB64 = parts[3];
    ciphertextB64 = parts[4];
  } else {
    ivB64 = parts[1];
    tagB64 = parts[2];
    ciphertextB64 = parts[3];
  }

  return {
    aad,
    algorithm: params.algorithm,
    authTag: B64.toBuffer(tagB64, "b64u"),
    content: B64.toBuffer(ciphertextB64, "b64u"),
    contentType: params.contentType,
    encryption: params.encryption,
    initialisationVector: B64.toBuffer(ivB64, "b64u"),
    keyId: params.keyId,
    pbkdfIterations: params.pbkdfIterations,
    pbkdfSalt: params.pbkdfSalt,
    publicEncryptionIv: params.publicEncryptionIv,
    publicEncryptionJwk: params.publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag: params.publicEncryptionTag,
    version: params.version,
  };
};
