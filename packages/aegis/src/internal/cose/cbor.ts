import {
  cdeEncodeOptions,
  decode,
  defaultDecodeOptions,
  defaultEncodeOptions,
  encode,
} from "cbor2";
import { registerEncoder, writeUint8Array } from "cbor2/encoder";
import { CoseError } from "../../errors/index.js";

// ⚠ Without this registration a Node `Buffer` falls through to its `toJSON()` and
// encodes as a `{ type: "Buffer", data: [...] }` map instead of a CBOR byte
// string. aegis is the only cbor2 consumer here, so the global registration is safe.
registerEncoder(Buffer, (buffer, writer) => {
  writeUint8Array(buffer, writer);
  return undefined;
});

export type CborEncodeOptions = {
  /**
   * Emit deterministic CBOR (RFC 8949 §4.2.1). Defaults to `true`: COSE
   * `Sig_structure`/`Enc_structure` and CWT payloads must be reproducible
   * byte-for-byte. `false` only where canonical ordering is not required.
   */
  deterministic?: boolean;
};

export type CborDecodeOptions = {
  /**
   * Decode CBOR maps to JS `Map` (default `true`) — COSE/CWT maps are
   * integer-keyed, which JS object keys cannot represent faithfully.
   */
  preferMap?: boolean;
  /** Reject duplicate map keys (default `true`) — a parsing ambiguity. */
  rejectDuplicateKeys?: boolean;
};

/** Encode a value as CBOR, canonical by default. */
export const encodeCbor = (value: unknown, options: CborEncodeOptions = {}): Buffer => {
  const { deterministic = true } = options;

  try {
    return Buffer.from(
      encode(value, deterministic ? cdeEncodeOptions : defaultEncodeOptions),
    );
  } catch (error) {
    throw new CoseError("Failed to encode value as CBOR", {
      code: "cbor_encode_failed",
      title: "CBOR Encode Failed",
      details:
        "The value could not be encoded as CBOR; see the underlying error for the root cause.",
      error: error as Error,
    });
  }
};

/**
 * Decode CBOR. Lenient about canonical form — other COSE implementations emit
 * non-canonical input — but preserves integer-keyed maps and rejects duplicates.
 */
export const decodeCbor = <T = unknown>(
  input: Buffer | Uint8Array,
  options: CborDecodeOptions = {},
): T => {
  const { preferMap = true, rejectDuplicateKeys = true } = options;

  try {
    return decode<T>(input, { ...defaultDecodeOptions, preferMap, rejectDuplicateKeys });
  } catch (error) {
    throw new CoseError("Failed to decode CBOR", {
      code: "cbor_decode_failed",
      title: "CBOR Decode Failed",
      details:
        "The input could not be decoded as CBOR; it may be malformed, truncated, or contain duplicate map keys.",
      error: error as Error,
    });
  }
};

// Re-exported for COSE tag construction; the numbers live in `COSE_TAG`.
export { Tag } from "cbor2";
