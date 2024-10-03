import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { AesEncryptionRecord, PublicEncryptionJwk } from "../../types";

/**
 * Compresses the AesEncryptionData into a base64 URL-safe string.
 * Each field is encoded with a length prefix for easy decoding.
 * Optional fields are conditionally encoded based on their presence.
 *
 * @param data - The AES encryption data to compress.
 * @returns The base64url-encoded string representing the compressed data.
 */
export const createEncodedAesString = (data: AesEncryptionRecord): string => {
  const buffers: Buffer[] = [];

  // Add version (number) with length prefix
  const version = Buffer.from(data.version.toString());
  buffers.push(Buffer.from([version.length]), version);

  // Add keyId (string) with length prefix
  const keyId = Buffer.from(data.keyId);
  buffers.push(Buffer.from([keyId.length]), keyId);

  // Add algorithm (KryptosAlgorithm) with length prefix
  const algorithm = Buffer.from(data.algorithm);
  buffers.push(Buffer.from([algorithm.length]), algorithm);

  // Add encryption (KryptosEncryption) with length prefix
  const encryption = Buffer.from(data.encryption);
  buffers.push(Buffer.from([encryption.length]), encryption);

  // Add authTag (Buffer) with length prefix
  buffers.push(Buffer.from([data.authTag.length]), data.authTag);

  // Add content (Buffer) with length prefix
  buffers.push(Buffer.from([data.content.length]), data.content);

  // Add initialization vector (Buffer) with length prefix
  buffers.push(
    Buffer.from([data.initialisationVector.length]),
    data.initialisationVector,
  );

  // Optional fields section
  const optionalFields: Buffer[] = [];

  // Add hkdfSalt (optional) with a marker and length prefix
  if (data.hkdfSalt) {
    optionalFields.push(Buffer.from([1])); // Field exists
    optionalFields.push(Buffer.from([data.hkdfSalt.length]), data.hkdfSalt);
  } else {
    optionalFields.push(Buffer.from([0])); // Field does not exist
  }

  // Add pbkdfIterations (optional) only if pbkdfSalt exists
  if (data.pbkdfSalt) {
    const pbkdfIterations = Buffer.alloc(4); // Allocate space for 32-bit integer
    pbkdfIterations.writeUInt32BE(data.pbkdfIterations || 0);
    optionalFields.push(Buffer.from([1])); // Field exists
    optionalFields.push(pbkdfIterations);
  } else {
    optionalFields.push(Buffer.from([0])); // Field does not exist
  }

  // Add pbkdfSalt (optional)
  if (data.pbkdfSalt) {
    optionalFields.push(Buffer.from([1])); // Field exists
    optionalFields.push(Buffer.from([data.pbkdfSalt.length]), data.pbkdfSalt);
  } else {
    optionalFields.push(Buffer.from([0])); // Field does not exist
  }

  // Add publicEncryptionIv (optional)
  if (data.publicEncryptionIv) {
    optionalFields.push(Buffer.from([1])); // Field exists
    optionalFields.push(
      Buffer.from([data.publicEncryptionIv.length]),
      data.publicEncryptionIv,
    );
  } else {
    optionalFields.push(Buffer.from([0])); // Field does not exist
  }

  // Add publicEncryptionJwk (optional)
  const publicEncryptionJwkStr = data.publicEncryptionJwk
    ? JSON.stringify(data.publicEncryptionJwk)
    : "";
  if (publicEncryptionJwkStr.length > 0) {
    optionalFields.push(Buffer.from([1])); // Field exists
    optionalFields.push(
      Buffer.from([publicEncryptionJwkStr.length]),
      Buffer.from(publicEncryptionJwkStr),
    );
  } else {
    optionalFields.push(Buffer.from([0])); // Field does not exist
  }

  // Add publicEncryptionKey (optional) with a 4-byte length prefix
  if (data.publicEncryptionKey) {
    optionalFields.push(Buffer.from([1])); // Field exists
    const keyLength = Buffer.alloc(4); // Use 4 bytes to store length
    keyLength.writeUInt32BE(data.publicEncryptionKey.length);
    optionalFields.push(keyLength, data.publicEncryptionKey);
  } else {
    optionalFields.push(Buffer.from([0])); // Field does not exist
  }

  // Add publicEncryptionTag (optional)
  if (data.publicEncryptionTag) {
    optionalFields.push(Buffer.from([1])); // Field exists
    optionalFields.push(
      Buffer.from([data.publicEncryptionTag.length]),
      data.publicEncryptionTag,
    );
  } else {
    optionalFields.push(Buffer.from([0])); // Field does not exist
  }

  // Calculate and add total length of optional fields section
  const optionalFieldsLength = Buffer.alloc(4); // 4-byte integer to store length
  optionalFieldsLength.writeUInt32BE(Buffer.concat(optionalFields).length);
  buffers.push(optionalFieldsLength, ...optionalFields);

  // Concatenate all buffers and encode the final result to base64url
  return Buffer.concat(buffers).toString("base64url");
};

/**
 * Decompresses the base64 URL-safe string into an AesEncryptionData object.
 * The string is decoded field-by-field, respecting length prefixes.
 *
 * @param encoded - The base64url-encoded compressed AES encryption data.
 * @returns The decompressed AesEncryptionData object.
 */
export const parseEncodedAesString = (encoded: string): AesEncryptionRecord => {
  const buffer = Buffer.from(encoded, "base64url");
  let offset = 0;

  // Helper function to read length-prefixed fields
  const readFieldWithLength = (): Buffer => {
    const length = buffer.readUInt8(offset);
    offset += 1;
    const field = buffer.slice(offset, offset + length);
    offset += length;
    return field;
  };

  const readOptionalFieldWithLength = (): Buffer | undefined => {
    const exists = buffer.readUInt8(offset);
    offset += 1;
    if (exists === 0) return undefined; // Field does not exist
    const length = buffer.readUInt8(offset);
    offset += 1;
    const field = buffer.slice(offset, offset + length);
    offset += length;
    return field;
  };

  const readOptionalFieldWithLargeLength = (): Buffer | undefined => {
    const exists = buffer.readUInt8(offset);
    offset += 1;
    if (exists === 0) return undefined; // Field does not exist
    const length = buffer.readUInt32BE(offset); // Read the 4-byte length
    offset += 4;
    const field = buffer.slice(offset, offset + length);
    offset += length;
    return field;
  };

  // Read version (number)
  const versionLength = buffer.readUInt8(offset);
  offset += 1;
  const version = parseInt(buffer.slice(offset, offset + versionLength).toString(), 10);
  offset += versionLength;

  // Read keyId (string)
  const keyId = readFieldWithLength().toString();

  // Read algorithm (KryptosAlgorithm)
  const algorithm = readFieldWithLength().toString() as KryptosAlgorithm;

  // Read encryption (KryptosEncryption)
  const encryption = readFieldWithLength().toString() as KryptosEncryption;

  // Read authTag (Buffer)
  const authTag = readFieldWithLength();

  // Read content (Buffer)
  const content = readFieldWithLength();

  // Read initialization vector (Buffer)
  const initialisationVector = readFieldWithLength();

  // Read optional fields section length (4-byte integer)
  const optionalFieldsLength = buffer.readUInt32BE(offset);
  offset += 4;
  const optionalFieldsStart = offset; // Mark the start of the optional fields

  // Read optional fields (based on markers and lengths)
  const hkdfSalt = readOptionalFieldWithLength();
  let pbkdfIterations: number | undefined;
  const pbkdfIterationsExists = buffer.readUInt8(offset);
  offset += 1;
  if (pbkdfIterationsExists === 1) {
    pbkdfIterations = buffer.readUInt32BE(offset);
    offset += 4;
  }
  const pbkdfSalt = readOptionalFieldWithLength();
  const publicEncryptionIv = readOptionalFieldWithLength();

  let publicEncryptionJwk: PublicEncryptionJwk | undefined;
  const publicEncryptionJwkBuffer = readOptionalFieldWithLength();
  if (publicEncryptionJwkBuffer) {
    const jwkString = publicEncryptionJwkBuffer.toString();
    try {
      publicEncryptionJwk = JSON.parse(jwkString);
    } catch (_) {
      throw new SyntaxError(`Invalid JSON in publicEncryptionJwk: ${jwkString}`);
    }
  }

  const publicEncryptionKey = readOptionalFieldWithLargeLength();
  const publicEncryptionTag = readOptionalFieldWithLength();

  // Verify that we have consumed the entire optionalFields section
  const optionalFieldsEnd = offset;
  if (optionalFieldsEnd - optionalFieldsStart !== optionalFieldsLength) {
    throw new Error("Optional fields length mismatch");
  }

  // Return the reconstructed AesEncryptionRecord object
  return {
    version,
    keyId,
    algorithm,
    encryption,
    authTag,
    content,
    initialisationVector,
    hkdfSalt,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  };
};
