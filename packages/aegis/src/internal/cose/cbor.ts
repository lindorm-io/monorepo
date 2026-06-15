import {
  cdeEncodeOptions,
  decode,
  defaultDecodeOptions,
  defaultEncodeOptions,
  encode,
} from "cbor2";
import { registerEncoder, writeUint8Array } from "cbor2/encoder";
import { AegisError } from "../../errors/index.js";

// cbor2 only treats a plain `Uint8Array` as a CBOR byte string; a Node `Buffer`
// (a Uint8Array subclass) otherwise falls through to its `toJSON()` and encodes
// as a `{ type: "Buffer", data: [...] }` map. COSE byte strings (keys, payloads,
// tags) are everywhere and the whole lindorm stack is Buffer-centric, so
// register Buffer to encode as a byte string. aegis is the only cbor2 consumer
// in this package, so this one-time global registration is intentional.
registerEncoder(Buffer, (buffer, writer) => {
  writeUint8Array(buffer, writer);
  return undefined;
});

export type CborEncodeOptions = {
  /**
   * Emit deterministic (RFC 8949 §4.2.1 core / CDE) CBOR. Defaults to `true`:
   * COSE `Sig_structure`/`Enc_structure` and CWT payloads MUST be reproducible
   * byte-for-byte. Set `false` only when canonical ordering is not required.
   */
  deterministic?: boolean;
};

export type CborDecodeOptions = {
  /**
   * Decode CBOR maps to JS `Map` (default `true`). COSE/CWT maps are
   * integer-keyed, which JS object keys cannot represent faithfully.
   */
  preferMap?: boolean;
  /**
   * Reject duplicate map keys (default `true`) — a parsing-ambiguity attack
   * surface called out in the CBOR/COSE/CWT security considerations.
   */
  rejectDuplicateKeys?: boolean;
};

/**
 * Encode a value as CBOR, canonical by default. Returns a `Buffer`.
 */
export const encodeCbor = (value: unknown, options: CborEncodeOptions = {}): Buffer => {
  const { deterministic = true } = options;

  try {
    return Buffer.from(
      encode(value, deterministic ? cdeEncodeOptions : defaultEncodeOptions),
    );
  } catch (error) {
    throw new AegisError("Failed to encode value as CBOR", {
      code: "cbor_encode_failed",
      title: "CBOR Encode Failed",
      details:
        "The value could not be encoded as CBOR; see the underlying error for the root cause.",
      error: error as Error,
    });
  }
};

/**
 * Decode CBOR. Lenient about canonical form (accepts non-canonical input from
 * other COSE implementations) but preserves integer-keyed maps and rejects
 * duplicate keys.
 */
export const decodeCbor = <T = unknown>(
  input: Buffer | Uint8Array,
  options: CborDecodeOptions = {},
): T => {
  const { preferMap = true, rejectDuplicateKeys = true } = options;

  try {
    return decode<T>(input, { ...defaultDecodeOptions, preferMap, rejectDuplicateKeys });
  } catch (error) {
    throw new AegisError("Failed to decode CBOR", {
      code: "cbor_decode_failed",
      title: "CBOR Decode Failed",
      details:
        "The input could not be decoded as CBOR; it may be malformed, truncated, or contain duplicate map keys.",
      error: error as Error,
    });
  }
};

// Re-export the cbor2 Tag for COSE tag construction (COSE_Sign1 = 18,
// COSE_Encrypt0 = 16, CWT = 61).
export { Tag } from "cbor2";
