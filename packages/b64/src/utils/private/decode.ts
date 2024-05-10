export const _decode = (input: string): Buffer => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");

  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLength);

  return Buffer.from(padded, "base64");
};
