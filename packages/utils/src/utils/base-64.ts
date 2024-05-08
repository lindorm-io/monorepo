export const encodeBase64 = (input: string): string => Buffer.from(input).toString("base64");

export const decodeBase64 = (input: string): string =>
  Buffer.from(input, "base64").toString("utf8");
