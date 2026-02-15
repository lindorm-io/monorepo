import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import { AesContentType, AesEncryptionRecord, PublicEncryptionJwk } from "../../types";

export const createEncodedAesString = (data: AesEncryptionRecord): string => {
  const buffers: Buffer[] = [];

  const version = Buffer.from(data.version.toString());
  buffers.push(Buffer.from([version.length]), version);

  const keyId = Buffer.from(data.keyId);
  buffers.push(Buffer.from([keyId.length]), keyId);

  const algorithm = Buffer.from(data.algorithm);
  buffers.push(Buffer.from([algorithm.length]), algorithm);

  const encryption = Buffer.from(data.encryption);
  buffers.push(Buffer.from([encryption.length]), encryption);

  const contentType = Buffer.from(data.contentType);
  buffers.push(Buffer.from([contentType.length]), contentType);

  buffers.push(Buffer.from([data.authTag.length]), data.authTag);

  buffers.push(
    Buffer.from([data.initialisationVector.length]),
    data.initialisationVector,
  );

  const optionalFields: Buffer[] = [];

  if (data.hkdfSalt) {
    optionalFields.push(Buffer.from([1]));
    optionalFields.push(Buffer.from([data.hkdfSalt.length]), data.hkdfSalt);
  } else {
    optionalFields.push(Buffer.from([0]));
  }

  if (data.pbkdfSalt) {
    const pbkdfIterations = Buffer.alloc(4);
    pbkdfIterations.writeUInt32BE(data.pbkdfIterations || 0);
    optionalFields.push(Buffer.from([1]));
    optionalFields.push(pbkdfIterations);
  } else {
    optionalFields.push(Buffer.from([0]));
  }

  if (data.pbkdfSalt) {
    optionalFields.push(Buffer.from([1]));
    optionalFields.push(Buffer.from([data.pbkdfSalt.length]), data.pbkdfSalt);
  } else {
    optionalFields.push(Buffer.from([0]));
  }

  if (data.publicEncryptionIv) {
    optionalFields.push(Buffer.from([1]));
    optionalFields.push(
      Buffer.from([data.publicEncryptionIv.length]),
      data.publicEncryptionIv,
    );
  } else {
    optionalFields.push(Buffer.from([0]));
  }

  const publicEncryptionJwkStr = data.publicEncryptionJwk
    ? JSON.stringify(data.publicEncryptionJwk)
    : "";
  if (publicEncryptionJwkStr.length > 255) {
    throw new AesError(
      "Public encryption JWK exceeds maximum encoded length (255 bytes)",
    );
  }
  if (publicEncryptionJwkStr.length > 0) {
    optionalFields.push(Buffer.from([1]));
    optionalFields.push(
      Buffer.from([publicEncryptionJwkStr.length]),
      Buffer.from(publicEncryptionJwkStr),
    );
  } else {
    optionalFields.push(Buffer.from([0]));
  }

  if (data.publicEncryptionKey) {
    optionalFields.push(Buffer.from([1]));
    const keyLength = Buffer.alloc(4);
    keyLength.writeUInt32BE(data.publicEncryptionKey.length);
    optionalFields.push(keyLength, data.publicEncryptionKey);
  } else {
    optionalFields.push(Buffer.from([0]));
  }

  if (data.publicEncryptionTag) {
    optionalFields.push(Buffer.from([1]));
    optionalFields.push(
      Buffer.from([data.publicEncryptionTag.length]),
      data.publicEncryptionTag,
    );
  } else {
    optionalFields.push(Buffer.from([0]));
  }

  const optionalFieldsLength = Buffer.alloc(4);
  optionalFieldsLength.writeUInt32BE(Buffer.concat(optionalFields).length);
  buffers.push(optionalFieldsLength, ...optionalFields);

  buffers.push(data.content);

  return Buffer.concat(buffers).toString("base64url");
};

export const parseEncodedAesString = (encoded: string): AesEncryptionRecord => {
  const buffer = Buffer.from(encoded, "base64url");
  let offset = 0;

  const readFieldWithLength = (): Buffer => {
    if (offset >= buffer.length) {
      throw new AesError("Unexpected end of encoded AES data");
    }
    const length = buffer.readUInt8(offset);
    offset += 1;
    if (offset + length > buffer.length) {
      throw new AesError("Encoded AES field exceeds buffer length");
    }
    const field = buffer.subarray(offset, offset + length);
    offset += length;
    return field;
  };

  const readOptionalFieldWithLength = (): Buffer | undefined => {
    if (offset >= buffer.length) {
      throw new AesError("Unexpected end of encoded AES data");
    }
    const exists = buffer.readUInt8(offset);
    offset += 1;
    if (exists === 0) return undefined;
    if (offset >= buffer.length) {
      throw new AesError("Unexpected end of encoded AES data");
    }
    const length = buffer.readUInt8(offset);
    offset += 1;
    if (offset + length > buffer.length) {
      throw new AesError("Encoded AES field exceeds buffer length");
    }
    const field = buffer.subarray(offset, offset + length);
    offset += length;
    return field;
  };

  const readOptionalFieldWithLargeLength = (): Buffer | undefined => {
    if (offset >= buffer.length) {
      throw new AesError("Unexpected end of encoded AES data");
    }
    const exists = buffer.readUInt8(offset);
    offset += 1;
    if (exists === 0) return undefined;
    if (offset + 4 > buffer.length) {
      throw new AesError("Unexpected end of encoded AES data");
    }
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    if (offset + length > buffer.length) {
      throw new AesError("Encoded AES field exceeds buffer length");
    }
    const field = buffer.subarray(offset, offset + length);
    offset += length;
    return field;
  };

  if (offset >= buffer.length) {
    throw new AesError("Unexpected end of encoded AES data");
  }
  const versionLength = buffer.readUInt8(offset);
  offset += 1;
  if (offset + versionLength > buffer.length) {
    throw new AesError("Encoded AES field exceeds buffer length");
  }
  const version = parseInt(
    buffer.subarray(offset, offset + versionLength).toString(),
    10,
  );
  offset += versionLength;

  const keyId = readFieldWithLength().toString();
  const algorithm = readFieldWithLength().toString() as KryptosAlgorithm;
  const encryption = readFieldWithLength().toString() as KryptosEncryption;
  const contentType = readFieldWithLength().toString() as AesContentType;
  const authTag = readFieldWithLength();
  const initialisationVector = readFieldWithLength();

  const optionalFieldsLength = buffer.readUInt32BE(offset);
  offset += 4;

  const optionalFieldsStart = offset;

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
    } catch {
      throw new AesError(`Invalid JSON in publicEncryptionJwk: ${jwkString}`);
    }
  }

  const publicEncryptionKey = readOptionalFieldWithLargeLength();
  const publicEncryptionTag = readOptionalFieldWithLength();

  const optionalFieldsEnd = offset;
  if (optionalFieldsEnd - optionalFieldsStart !== optionalFieldsLength) {
    throw new AesError("Optional fields length mismatch");
  }

  const content = buffer.subarray(offset);

  return {
    algorithm,
    authTag,
    content,
    contentType,
    encryption,
    hkdfSalt,
    initialisationVector,
    keyId,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
    version,
  };
};
