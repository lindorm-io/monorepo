import { B64 } from "@lindorm/b64";
import { AesError } from "../../errors";
import { AesEncryptionRecord, ParsedAesDecryptionRecord } from "../../types";
import {
  buildAesHeader,
  computeAad,
  decodeAesHeader,
  headerToDecryptionParams,
} from "./aes-header";

/**
 * New encoded binary layout (v1.0):
 *
 * [2 bytes: header JSON length (uint16 BE)]
 * [N bytes: header JSON]
 * [2 bytes: CEK length (uint16 BE)]  -- 0 for dir mode
 * [M bytes: CEK]
 * [IV bytes]                    -- 12B (GCM) or 16B (CBC), derived from enc
 * [Tag bytes]                   -- 16B (GCM) or 32B (CBC-HMAC), derived from enc
 * [remaining bytes: ciphertext]
 *
 * The entire binary blob is base64url-encoded as a single string.
 *
 * AAD = the base64url-encoded header JSON (same as tokenised/serialised).
 */

const getIvSize = (enc: string): number => (enc.includes("GCM") ? 12 : 16);

/**
 * Returns the auth tag size for a given encryption algorithm.
 * - GCM: always 16 bytes
 * - CBC-HMAC: half the SHA hash output (RFC 7518 Section 5.2.2.1)
 *   - A128CBC-HS256 -> SHA256 (32 bytes) -> T = 16 bytes
 *   - A192CBC-HS384 -> SHA384 (48 bytes) -> T = 24 bytes
 *   - A256CBC-HS512 -> SHA512 (64 bytes) -> T = 32 bytes
 */
const getTagSize = (enc: string): number => {
  if (enc.includes("GCM")) return 16;
  if (enc === "A128CBC-HS256") return 16;
  if (enc === "A192CBC-HS384") return 24;
  if (enc === "A256CBC-HS512") return 32;
  // Fallback for unknown CBC-HMAC variants
  return 16;
};

export const createEncodedAesString = (data: AesEncryptionRecord): string => {
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

  const headerJson = Buffer.from(JSON.stringify(header), "utf8");
  const buffers: Buffer[] = [];

  // Header length (uint16 BE) + header JSON
  const headerLength = Buffer.alloc(2);
  headerLength.writeUInt16BE(headerJson.length);
  buffers.push(headerLength, headerJson);

  // CEK length (uint16 BE) + CEK
  const cekLength = data.publicEncryptionKey?.length ?? 0;
  const cekLengthBuf = Buffer.alloc(2);
  cekLengthBuf.writeUInt16BE(cekLength);
  buffers.push(cekLengthBuf);
  if (data.publicEncryptionKey) {
    buffers.push(data.publicEncryptionKey);
  }

  // IV (fixed size, determined by encryption)
  buffers.push(data.initialisationVector);

  // Tag (fixed size, determined by encryption)
  buffers.push(data.authTag);

  // Ciphertext (remaining)
  buffers.push(data.content);

  return B64.encode(Buffer.concat(buffers), "b64u");
};

export const parseEncodedAesString = (encoded: string): ParsedAesDecryptionRecord => {
  const buffer = B64.toBuffer(encoded, "b64u");
  let offset = 0;

  // Read header length (uint16 BE)
  if (offset + 2 > buffer.length) {
    throw new AesError("Unexpected end of encoded AES data: missing header length");
  }
  const headerJsonLength = buffer.readUInt16BE(offset);
  offset += 2;

  // Read header JSON
  if (offset + headerJsonLength > buffer.length) {
    throw new AesError("Unexpected end of encoded AES data: header exceeds buffer");
  }
  const headerJsonBytes = buffer.subarray(offset, offset + headerJsonLength);
  offset += headerJsonLength;

  // Decode and validate header
  const headerB64 = B64.encode(headerJsonBytes, "b64u");
  const decodedHeader = decodeAesHeader(headerB64);
  const params = headerToDecryptionParams(decodedHeader);

  // Compute AAD from header JSON bytes
  const aad = computeAad(headerB64);

  // Read CEK length (uint16 BE)
  if (offset + 2 > buffer.length) {
    throw new AesError("Unexpected end of encoded AES data: missing CEK length");
  }
  const cekLength = buffer.readUInt16BE(offset);
  offset += 2;

  // Read CEK
  let publicEncryptionKey: Buffer | undefined;
  if (cekLength > 0) {
    if (offset + cekLength > buffer.length) {
      throw new AesError("Unexpected end of encoded AES data: CEK exceeds buffer");
    }
    publicEncryptionKey = buffer.subarray(offset, offset + cekLength);
    offset += cekLength;
  }

  // Read IV (fixed size from encryption)
  const ivSize = getIvSize(params.encryption);
  if (offset + ivSize > buffer.length) {
    throw new AesError("Unexpected end of encoded AES data: IV exceeds buffer");
  }
  const initialisationVector = buffer.subarray(offset, offset + ivSize);
  offset += ivSize;

  // Read tag (fixed size from encryption)
  const tagSize = getTagSize(params.encryption);
  if (offset + tagSize > buffer.length) {
    throw new AesError("Unexpected end of encoded AES data: tag exceeds buffer");
  }
  const authTag = buffer.subarray(offset, offset + tagSize);
  offset += tagSize;

  // Remaining = ciphertext
  const content = buffer.subarray(offset);

  return {
    aad,
    algorithm: params.algorithm,
    authTag,
    content,
    contentType: params.contentType,
    encryption: params.encryption,
    initialisationVector,
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
