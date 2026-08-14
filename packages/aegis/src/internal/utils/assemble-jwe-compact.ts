import { B64 } from "@lindorm/b64";
import { B64U } from "../constants/format.js";

/**
 * Assemble the JWE Compact Serialization (RFC 7516 §7.1): the ALREADY-ENCODED
 * protected header, then the four base64url segments, dot-joined. A key
 * management that produces no encrypted key (`dir`, ECDH-ES direct) leaves that
 * segment EMPTY rather than omitting it — the five dots are the grammar.
 *
 * The write twin of `splitJweCompact`, but NOT its mirror image in shape: this
 * takes the raw crypto output (Buffers), while the reader yields the base64url
 * segments the AES decryption record consumes.
 */
export const assembleJweCompact = ({
  header,
  publicEncryptionKey,
  initialisationVector,
  content,
  authTag,
}: {
  /** The base64url protected header, exactly as the AAD covered it. */
  header: string;
  publicEncryptionKey: Buffer | undefined;
  initialisationVector: Buffer;
  content: Buffer;
  authTag: Buffer;
}): string =>
  [
    header,
    publicEncryptionKey ? B64.encode(publicEncryptionKey, B64U) : "",
    B64.encode(initialisationVector, B64U),
    B64.encode(content, B64U),
    B64.encode(authTag, B64U),
  ].join(".");
