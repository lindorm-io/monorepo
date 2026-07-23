import { B64 } from "@lindorm/b64";
import { AES_FORMAT_VERSION } from "../constants/version.js";
import type { AesCborRecord } from "../constants/cbor-spec.js";
import { AES_CBOR_KIT } from "../constants/cbor-spec.js";
import { AesError } from "../../errors/AesError.js";
import type { ParsedAesDecryptionRecord } from "../../types/aes-decryption-data.js";

/**
 * CBOR format (v1):
 *
 *   aes:<base64url(CBOR(map))>
 *
 * Detection: string.startsWith("aes:"). The AAD is recomputed as the
 * deterministic CBOR encoding of the header-only fields — identical to the value
 * bound at encrypt time (see `encrypt-cbor.ts`).
 */
export const parseCborAesString = (data: string): ParsedAesDecryptionRecord => {
  if (!data.startsWith("aes:")) {
    throw new AesError("Invalid CBOR AES string: must start with 'aes:'", {
      code: "invalid_cbor_string",
      title: "Invalid CBOR String",
      details: "A CBOR AES string must begin with the 'aes:' prefix.",
    });
  }

  const bytes = B64.toBuffer(data.slice(4), "b64u");
  const decoded = AES_CBOR_KIT.decode(new Uint8Array(bytes));

  // The header-only re-encode reproduces the encrypt-time AAD byte-for-byte:
  // strip the material fields and encode the remainder through the same codec.
  const { initialisationVector, authTag, content, ...header } = decoded;
  const aad = Buffer.from(AES_CBOR_KIT.encode(header as AesCborRecord));

  return {
    aad,
    algorithm: decoded.algorithm,
    apu: decoded.apu,
    apv: decoded.apv,
    authTag,
    content,
    contentType: decoded.contentType,
    encryption: decoded.encryption,
    initialisationVector,
    keyId: decoded.keyId,
    pbkdfIterations: decoded.pbkdfIterations,
    pbkdfSalt: decoded.pbkdfSalt,
    publicEncryptionIv: decoded.publicEncryptionIv,
    publicEncryptionJwk: decoded.publicEncryptionJwk,
    publicEncryptionKey: decoded.publicEncryptionKey,
    publicEncryptionTag: decoded.publicEncryptionTag,
    version: AES_FORMAT_VERSION,
  };
};
