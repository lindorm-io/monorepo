import type { Base64Encoding } from "../types/index.js";

export const decode = (input: string, encoding?: Base64Encoding): Uint8Array => {
  const normalized =
    encoding === "base64" ? input : input.replace(/-/g, "+").replace(/_/g, "/");

  return Uint8Array.fromBase64(normalized, {
    alphabet: "base64",
    lastChunkHandling: "loose",
  });
};
