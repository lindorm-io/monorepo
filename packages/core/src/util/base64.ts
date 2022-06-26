export const baseHash = (input: string): string => Buffer.from(input).toString("base64");

export const baseParse = (input: string): string => Buffer.from(input, "base64").toString("utf8");

const fromBase64 = (base64: string): string =>
  base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

export const encodeBase64Url = (input: any, encoding: BufferEncoding = "utf8"): string => {
  if (Buffer.isEncoding("base64url")) {
    return Buffer.from(input, encoding).toString("base64url");
  } else {
    return fromBase64(Buffer.from(input, encoding).toString("base64"));
  }
};

export const decodeBase64Url = (input: string): string =>
  Buffer.from(input, "base64").toString("utf8");
