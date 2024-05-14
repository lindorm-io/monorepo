import { Base64Encoding } from "../../types";

export const _decode = (input: string, encoding?: Base64Encoding): Buffer => {
  if (encoding === "base64") {
    return Buffer.from(input, "base64");
  }

  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");

  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLength);

  return Buffer.from(padded, "base64");
};
