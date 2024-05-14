import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateOctSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: Kryptos;
};

export type VerifyOctSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: Kryptos;
  signature: string;
};

export type OctKitOptions = {
  format?: BufferFormat;
  kryptos: Kryptos;
};
