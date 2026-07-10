// base62 alphabet backing the ecosystem `key_` kid convention.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Map the leading `length` bytes of a digest/derivation onto a `key_`-prefixed
// base62 id. Modulo bias is irrelevant here — this is an identifier, not secret
// key material. Consumed by both the HKDF-tail derive path and the thumbprint
// key-id path so the two share one encoding.
export const keyIdFromBytes = (bytes: Buffer, length = 16): string => {
  let id = "";
  for (const byte of bytes.subarray(0, length)) id += ALPHABET[byte % 62];
  return `key_${id}`;
};
