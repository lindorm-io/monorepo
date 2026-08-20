import type { Dict } from "@lindorm/types";
import { JweError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { decodeJoseHeader } from "./jose-header.js";

/**
 * The five wire segments of a compact JWE (RFC 7516 §7.1).
 *
 * It lives beside the SPLITTER, not in `types/`, because it is what this reader
 * produces and nothing else builds one — the same placement `Encrypt0Segments`
 * has beside `splitEncrypt0`, its COSE counterpart. `assembleJweCompact` takes a
 * different shape entirely (raw Buffers), so there is no type shared between the
 * two halves to hoist.
 */
export type JweCompactSegments = {
  header: WireTokenHeader;
  /** The protected header's params no registry row answers for, verbatim. */
  unknown: Dict;
  publicEncryptionKey: string | undefined;
  initialisationVector: string;
  content: string;
  authTag: string;
};

/**
 * Split a compact JWE into its five wire segments, decoding the protected header
 * and leaving the other four base64url — the read twin of `assembleJweCompact`.
 */
export const splitJweCompact = (jwe: string): JweCompactSegments => {
  const parts = jwe.split(".");

  if (parts.length === 5) {
    const [header, publicEncryptionKey, initialisationVector, content, authTag] = parts;

    const decoded = decodeJoseHeader(header);

    return {
      header: decoded.header,
      unknown: decoded.unknown,
      publicEncryptionKey: publicEncryptionKey?.length ? publicEncryptionKey : undefined,
      initialisationVector,
      content,
      authTag,
    };
  }

  throw new JweError("Invalid JWE format: expected 5 parts", {
    code: "jwe_invalid_format",
    title: "JWE Invalid Format",
    details:
      "A compact JWE must have exactly five dot-separated segments (header, encrypted key, iv, ciphertext, tag).",
  });
};
