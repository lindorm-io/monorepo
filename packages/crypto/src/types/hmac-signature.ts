export type HmacSignatureAlgorithm = "SHA256" | "SHA384" | "SHA512";

export type HmacSignatureFormat = "base64" | "hex";

export type CreateHmacSignatureOptions = {
  algorithm?: HmacSignatureAlgorithm;
  data: string;
  format?: HmacSignatureFormat;
  secret: string;
};

export type VerifyHmacSignatureOptions = {
  algorithm?: HmacSignatureAlgorithm;
  data: string;
  format?: HmacSignatureFormat;
  secret: string;
  signature: string;
};
