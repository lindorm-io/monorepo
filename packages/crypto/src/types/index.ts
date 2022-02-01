export interface CryptoAESOptions {
  secret: string;
}

export interface CryptoArgonOptions {
  hashLength?: 64 | 128 | 256 | 512;
  memoryCost?: 1 | 2 | 4 | 8;
  parallelism?: number;
  saltLength?: 64 | 128 | 256 | 512;
  secret?: string;
  timeCost?: number;
}

export interface CryptoSHAOptions {
  secret: string;
}

export interface CryptoLayeredOptions {
  aes: CryptoAESOptions;
  argon?: CryptoArgonOptions;
  sha: CryptoSHAOptions;
}

export interface CryptoSecretOptions {
  aes: CryptoAESOptions;
  sha: CryptoSHAOptions;
}
