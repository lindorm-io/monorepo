export type CreateArgonHashOptions = {
  data: string;
  hashLength?: number;
  memoryCost?: number;
  parallelism?: number;
  secret?: string;
  timeCost?: number;
};

export type VerifyArgonHashOptions = {
  data: string;
  secret?: string;
  hash: string;
};

export type ArgonKitOptions = {
  hashLength?: number;
  memoryCost?: number;
  parallelism?: number;
  secret?: string;
  timeCost?: number;
};
