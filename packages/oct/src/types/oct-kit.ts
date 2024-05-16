import { IKryptosOct, Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateOctSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: IKryptosOct;
};

export type VerifyOctSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: IKryptosOct;
  signature: string;
};

export type OctKitOptions = {
  format?: BufferFormat;
  kryptos: Kryptos;
};
