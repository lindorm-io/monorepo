import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, HashAlgorithm } from "./types";

export type CreateRsaHashOptions = {
  algorithm?: HashAlgorithm;
  data: string;
  format?: BufferFormat;
  kryptos: Kryptos;
};

export type VerifyRsaHashOptions = {
  algorithm?: HashAlgorithm;
  data: string;
  format?: BufferFormat;
  kryptos: Kryptos;
  hash: string;
};
