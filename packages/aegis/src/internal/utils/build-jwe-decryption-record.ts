import type { AesDecryptionRecord } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import type { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { B64U } from "../constants/format.js";
import type { DomainTokenHeader } from "../../types/index.js";
import type { JweCompactSegments } from "./split-jwe-compact.js";

/**
 * Marshal a compact JWE's base64url wire values into the `AesDecryptionRecord`
 * the AES layer decrypts from — the read counterpart of the header the encrypt
 * side wrote.
 *
 * Which segment each value comes from is the point: the ciphertext, the IV, the
 * auth tag and the encrypted key are TOKEN SEGMENTS, while the PBKDF pair and
 * the ECDH-ES/key-wrap public material are HEADER parameters. The content type
 * is pinned to `application/octet-stream` because the AES layer only ever sees
 * OPAQUE bytes here — the JOSE `cty`, not the AES one, drives reconstruction
 * after the AEAD has verified.
 */
export const buildJweDecryptionRecord = ({
  segments,
  header,
  encryption,
  apu,
  apv,
  keyId,
}: {
  segments: JweCompactSegments;
  /** The parsed DOMAIN header — the source of every non-segment parameter. */
  header: DomainTokenHeader;
  /** The content encryption this kit accepts (already matched against the header). */
  encryption: KryptosEncryption;
  apu: Buffer | undefined;
  apv: Buffer | undefined;
  /** The configured key's id, used when the header names none. */
  keyId: string;
}): AesDecryptionRecord => ({
  algorithm: header.algorithm as KryptosEncAlgorithm,
  apu,
  apv,
  authTag: B64.toBuffer(segments.authTag),
  content: B64.toBuffer(segments.content),
  contentType: "application/octet-stream",
  encryption,
  initialisationVector: B64.toBuffer(segments.initialisationVector),
  keyId: header.keyId ?? keyId,
  pbkdfIterations: header.pbkdfIterations,
  pbkdfSalt: header.pbkdfSalt ? B64.toBuffer(header.pbkdfSalt, B64U) : undefined,
  publicEncryptionIv: header.initialisationVector
    ? B64.toBuffer(header.initialisationVector)
    : undefined,
  publicEncryptionJwk: header.publicEncryptionJwk,
  publicEncryptionKey: segments.publicEncryptionKey
    ? B64.toBuffer(segments.publicEncryptionKey)
    : undefined,
  publicEncryptionTag: header.publicEncryptionTag
    ? B64.toBuffer(header.publicEncryptionTag)
    : undefined,
  version: "1.0",
});
