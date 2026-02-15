import type { FlattenedJWE } from "jose";
import type { AesDecryptionRecord } from "../../src/types/aes-decryption-data";
import type { AesEncryptionRecord } from "../../src/types/aes-encryption-data";

/**
 * Build a JWE protected header JSON string, its base64url encoding,
 * and the AAD buffer (ASCII bytes of the base64url-encoded header).
 *
 * Per RFC 7516 section 5.1 step 14, the JWE AAD is the ASCII representation
 * of the base64url-encoded protected header.
 *
 * For A*GCMKW algorithms, the key-wrap iv and tag go into the protected header
 * per RFC 7518 section 4.7.
 */
export const buildProtectedHeader = (
  algorithm: string,
  encryption: string,
  gcmkwParams?: { iv: Buffer; tag: Buffer },
): {
  headerJson: string;
  headerB64u: string;
  aadBuffer: Buffer;
} => {
  const header: Record<string, string> = { alg: algorithm, enc: encryption };

  if (gcmkwParams) {
    header.iv = gcmkwParams.iv.toString("base64url");
    header.tag = gcmkwParams.tag.toString("base64url");
  }

  const headerJson = JSON.stringify(header);
  const headerB64u = Buffer.from(headerJson, "utf8").toString("base64url");
  const aadBuffer = Buffer.from(headerB64u, "ascii");

  return { headerJson, headerB64u, aadBuffer };
};

/**
 * Convert our AesEncryptionRecord to a jose FlattenedJWE object.
 *
 * Field mapping:
 *   - protected:      base64url-encoded protected header (passed in)
 *   - iv:             base64url of record.initialisationVector
 *   - ciphertext:     base64url of record.content
 *   - tag:            base64url of record.authTag
 *   - encrypted_key:  base64url of record.publicEncryptionKey (absent for dir)
 */
export const toFlattenedJWE = (
  record: AesEncryptionRecord,
  headerB64u: string,
): FlattenedJWE => {
  const jwe: FlattenedJWE = {
    protected: headerB64u,
    iv: record.initialisationVector.toString("base64url"),
    ciphertext: record.content.toString("base64url"),
    tag: record.authTag.toString("base64url"),
  };

  if (record.publicEncryptionKey) {
    jwe.encrypted_key = record.publicEncryptionKey.toString("base64url");
  }

  return jwe;
};

/**
 * Convert a jose FlattenedJWE back to our AesDecryptionRecord + the AAD buffer.
 *
 * Parses the protected header to extract algorithm, encryption, and optional
 * GCMKW parameters (iv, tag for key-wrap).
 *
 * Field mapping (inverse of toFlattenedJWE):
 *   - content:              Buffer from base64url ciphertext
 *   - initialisationVector: Buffer from base64url iv
 *   - authTag:              Buffer from base64url tag
 *   - publicEncryptionKey:  Buffer from base64url encrypted_key (undefined for dir)
 *   - publicEncryptionIv:   Buffer from protected header iv param (GCMKW only)
 *   - publicEncryptionTag:  Buffer from protected header tag param (GCMKW only)
 *   - encryption:           enc value from protected header
 *   - algorithm:            alg value from protected header
 */
export const fromFlattenedJWE = (
  jwe: FlattenedJWE,
): {
  record: AesDecryptionRecord;
  aad: Buffer;
} => {
  if (!jwe.protected) {
    throw new Error("FlattenedJWE missing protected header");
  }
  if (!jwe.iv) {
    throw new Error("FlattenedJWE missing iv");
  }
  if (!jwe.tag) {
    throw new Error("FlattenedJWE missing tag");
  }

  const headerJson = Buffer.from(jwe.protected, "base64url").toString("utf8");
  const header = JSON.parse(headerJson) as Record<string, string>;

  const aad = Buffer.from(jwe.protected, "ascii");

  const record: AesDecryptionRecord = {
    algorithm: header.alg as AesDecryptionRecord["algorithm"],
    encryption: header.enc as AesDecryptionRecord["encryption"],
    content: Buffer.from(jwe.ciphertext, "base64url"),
    initialisationVector: Buffer.from(jwe.iv, "base64url"),
    authTag: Buffer.from(jwe.tag, "base64url"),
    publicEncryptionKey: jwe.encrypted_key
      ? Buffer.from(jwe.encrypted_key, "base64url")
      : undefined,
    publicEncryptionIv: header.iv ? Buffer.from(header.iv, "base64url") : undefined,
    publicEncryptionTag: header.tag ? Buffer.from(header.tag, "base64url") : undefined,
  };

  return { record, aad };
};
