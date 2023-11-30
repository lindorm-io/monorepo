export type RsaCipherFormat = "base64" | "hex";

export type RsaCipherKey = string | { key: string; passphrase: string };

export type EncryptRsaCipherOptions = {
  format?: RsaCipherFormat;
  data: string;
  key: RsaCipherKey;
};

export type DecryptRsaCipherOptions = {
  cipher: string;
  format?: RsaCipherFormat;
  key: RsaCipherKey;
};

export type VerifyRsaCipherOptions = DecryptRsaCipherOptions & {
  data: string;
};
