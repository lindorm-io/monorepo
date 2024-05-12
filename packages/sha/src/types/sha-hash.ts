export type ShaHashAlgorithm = "SHA256" | "SHA384" | "SHA512";

export type ShaHashFormat = "base64" | "hex";

export type CreateShaHashOptions = {
  algorithm?: ShaHashAlgorithm;
  data: string;
  format?: ShaHashFormat;
};

export type VerifyShaHashOptions = {
  algorithm?: ShaHashAlgorithm;
  data: string;
  format?: ShaHashFormat;
  hash: string;
};

export type ShaKitOptions = {
  algorithm?: ShaHashAlgorithm;
  format?: ShaHashFormat;
};
