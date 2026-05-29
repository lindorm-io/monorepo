const ALPHABETS = {
  alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  base64url: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
  hex: "0123456789abcdef",
  lower: "abcdefghijklmnopqrstuvwxyz",
  numeric: "0123456789",
  // RFC 3986 §2.3 unreserved set — superset of base64url, includes . and ~.
  // Valid (and recommended-superset) for RFC 7636 PKCE code_verifier.
  unreserved: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~",
  // Crockford-style: omits 0/O/1/I/L to stay readable when typed by humans.
  unambiguous: "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
} as const;

export type RandomAlphabet = keyof typeof ALPHABETS;

// Uniform rejection sampling: bytes ≥ limit are discarded so each
// character of the alphabet is equally likely. limit is the largest
// multiple of alphabet.length that fits in a byte.
const sample = (alphabet: string, length: number): string => {
  const limit = 256 - (256 % alphabet.length);
  const out: Array<string> = [];
  while (out.length < length) {
    const batch = new Uint8Array(Math.ceil((length - out.length) * 1.5) + 8);
    globalThis.crypto.getRandomValues(batch);
    for (const byte of batch) {
      if (byte < limit && out.length < length) {
        out.push(alphabet[byte % alphabet.length]);
      }
    }
  }
  return out.join("");
};

export const randomString = (
  length: number,
  alphabet: RandomAlphabet = "alphanumeric",
): string => {
  if (length < 0) throw new Error("length must be non-negative");
  return sample(ALPHABETS[alphabet], length);
};
