export type ArgonSignatureHashLength = 64 | 128 | 256 | 512;

export type ArgonSignatureMemoryCost = 1 | 2 | 4 | 8 | 12 | 16 | 20 | 24 | 32;

export type ArgonSignatureSaltLength = 32 | 64 | 128 | 256 | 512;

export type CreateArgonSignatureOptions = {
  data: string;
  hashLength?: ArgonSignatureHashLength;
  memoryCost?: ArgonSignatureMemoryCost;
  parallelism?: number;
  salt?: string;
  saltLength?: ArgonSignatureSaltLength;
  secret?: string;
  timeCost?: number;
};

export type VerifyArgonSignatureOptions = {
  data: string;
  secret?: string;
  signature: string;
};
