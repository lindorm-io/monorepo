import { Kryptos } from "@lindorm/kryptos";

export type CreateArgonHashOptions = {
  data: string;
  hashLength?: number;
  kryptos?: Kryptos;
  memoryCost?: number;
  parallelism?: number;
  timeCost?: number;
};

export type VerifyArgonHashOptions = {
  data: string;
  hash: string;
  kryptos?: Kryptos;
};

export type ArgonKitOptions = {
  hashLength?: number;
  kryptos?: Kryptos;
  memoryCost?: number;
  parallelism?: number;
  timeCost?: number;
};
