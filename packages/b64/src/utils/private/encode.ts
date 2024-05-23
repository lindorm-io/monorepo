const toBase64Url = (base64: string): string =>
  base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

export const encodeBase64 = (
  input: Buffer | string,
  encoding: BufferEncoding = "utf8",
): string =>
  Buffer.isBuffer(input)
    ? input.toString("base64")
    : Buffer.from(input, encoding).toString("base64");

export const encodeBase64Url = (
  input: Buffer | string,
  encoding: BufferEncoding = "utf8",
): string => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, encoding);

  return Buffer.isEncoding("base64url")
    ? buffer.toString("base64url")
    : toBase64Url(buffer.toString("base64"));
};
