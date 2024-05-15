import { Kryptos, KryptosOct } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateOctSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: KryptosOct;
};

export type VerifyOctSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: KryptosOct;
  signature: string;
};

export type OctKitOptions = {
  format?: BufferFormat;
  kryptos: Kryptos;
};
