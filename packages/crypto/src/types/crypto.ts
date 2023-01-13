export type CryptoAESOptions = {
  secret: string;
};

export type CryptoArgonOptions = {
  hashLength?: 64 | 128 | 256 | 512;
  memoryCost?: 1 | 2 | 4 | 8;
  parallelism?: number;
  saltLength?: 64 | 128 | 256 | 512;
  secret?: string;
  timeCost?: number;
};

export type Hmac = "SHA256" | "SHA384" | "SHA512";

export type CryptoSHAOptions = {
  secret: string;
  hmac?: Hmac;
};

export type CryptoLayeredOptions = {
  aes: CryptoAESOptions;
  argon?: CryptoArgonOptions;
  sha: CryptoSHAOptions;
};

export type CryptoSecretOptions = {
  aes: CryptoAESOptions;
  sha: CryptoSHAOptions;
};
