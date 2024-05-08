const toBase64Url = (base64: string): string =>
  base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

export const encodeBase64Url = (input: any, encoding: BufferEncoding = "utf8"): string => {
  if (Buffer.isEncoding("base64url")) {
    return Buffer.from(input, encoding).toString("base64url");
  } else {
    return toBase64Url(Buffer.from(input, encoding).toString("base64"));
  }
};

export const decodeBase64Url = (input: string): string =>
  Buffer.from(input, "base64url").toString("utf8");
