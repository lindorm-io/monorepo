export type HmacHashAlgorithm = "SHA256" | "SHA384" | "SHA512";

export type HmacHashFormat = "base64" | "hex";

export type CreateHmacHashOptions = {
  algorithm?: HmacHashAlgorithm;
  data: string;
  format?: HmacHashFormat;
  secret: string;
};

export type VerifyHmacHashOptions = {
  algorithm?: HmacHashAlgorithm;
  data: string;
  format?: HmacHashFormat;
  secret: string;
  hash: string;
};

export type HmacKitOptions = {
  algorithm?: HmacHashAlgorithm;
  format?: HmacHashFormat;
  secret: string;
};
