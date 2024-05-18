import { IKryptos, IKryptosOct } from "@lindorm/kryptos";

export type CreateArgonHashOptions = {
  data: string;
  hashLength?: number;
  kryptos?: IKryptosOct;
  memoryCost?: number;
  parallelism?: number;
  timeCost?: number;
};

export type VerifyArgonHashOptions = {
  data: string;
  hash: string;
  kryptos?: IKryptosOct;
};

export type ArgonKitOptions = {
  hashLength?: number;
  kryptos?: IKryptos;
  memoryCost?: number;
  parallelism?: number;
  timeCost?: number;
};
