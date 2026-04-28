import type { Base64Encoding } from "../types/index.js";

const URL_ENCODINGS: ReadonlySet<Base64Encoding> = new Set([
  "base64url",
  "b64url",
  "b64u",
]);

export const encodeBytes = (
  input: Uint8Array | string,
  encoding: Base64Encoding,
): string => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const url = URL_ENCODINGS.has(encoding);

  return bytes.toBase64({
    alphabet: url ? "base64url" : "base64",
    omitPadding: url,
  });
};
