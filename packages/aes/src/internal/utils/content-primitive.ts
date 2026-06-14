import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../errors/index.js";
import { decryptAes } from "./encryption.js";
import { encryptAesContent } from "./encrypt-content.js";
import { getEncryptionKey } from "./get-key/get-encryption-key.js";

export type ContentPrimitiveResult = {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
};

export type EncryptContentDirectOptions = {
  aad?: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  initialisationVector?: Buffer;
  kryptos: IKryptos;
};

export type DecryptContentDirectOptions = {
  aad?: Buffer;
  ciphertext: Buffer;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
  kryptos: IKryptos;
  tag: Buffer;
};

/**
 * The header-less content-encryption seam for COSE_Encrypt0 (direct). It runs
 * the AEAD/CBC-HMAC cipher over opaque bytes with a caller-supplied AAD (e.g. a
 * COSE `Enc_structure`) and optional IV/nonce, returning the raw
 * `{ ciphertext, iv, tag }` with no lindorm header. The COSE kit owns the CBOR
 * envelope; this owns only the cipher.
 *
 * It is DIRECT only: the key must be used as the content-encryption key with no
 * recipient-side wrapping or derivation (i.e. a `dir` oct key). Wrapping /
 * key-agreement algorithms (AES-KW, ECDH-ES, RSA-OAEP, PBES2) produce recipient
 * material that a header-less result cannot carry, so they are rejected — use
 * the wire formats (or, later, COSE_Encrypt recipients) for those.
 */
export const encryptContentDirect = (
  options: EncryptContentDirectOptions,
): ContentPrimitiveResult => {
  const { aad, content, encryption, initialisationVector, kryptos } = options;

  const keyResult = getEncryptionKey({ encryption, kryptos });
  assertDirectKey(keyResult);

  const result = encryptAesContent({
    aad,
    contentEncryptionKey: keyResult.contentEncryptionKey,
    data: content,
    encryption,
    initialisationVector,
  });

  return {
    ciphertext: result.content,
    iv: result.initialisationVector,
    tag: result.authTag,
  };
};

/**
 * The decrypt counterpart to {@link encryptContentDirect}. Verifies the tag and
 * returns the raw plaintext bytes (no content-type round-trip — COSE payloads
 * are opaque). Same DIRECT-key constraint applies.
 */
export const decryptContentDirect = (options: DecryptContentDirectOptions): Buffer => {
  const { aad, ciphertext, encryption, initialisationVector, kryptos, tag } = options;

  return decryptAes<Buffer>({
    aad,
    authTag: tag,
    content: ciphertext,
    contentType: "application/octet-stream",
    encryption,
    initialisationVector,
    kryptos,
  });
};

const assertDirectKey = (keyResult: {
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: unknown;
  publicEncryptionKey?: Buffer;
}): void => {
  const wrapped =
    keyResult.publicEncryptionKey !== undefined ||
    keyResult.publicEncryptionJwk !== undefined ||
    keyResult.publicEncryptionIv !== undefined ||
    keyResult.pbkdfSalt !== undefined;

  if (wrapped) {
    throw new AesError("Content primitive requires a direct key", {
      code: "content_primitive_requires_direct_key",
      title: "Content Primitive Requires Direct Key",
      details:
        "encryptContent/decryptContent are the COSE_Encrypt0 (direct) seam and require the key to be used directly as the content-encryption key (a 'dir' oct key). Key-wrapping or key-agreement algorithms produce recipient material a header-less result cannot carry; use a wire format for those.",
    });
  }
};
