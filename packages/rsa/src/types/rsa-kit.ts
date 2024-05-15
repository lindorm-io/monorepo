import { Kryptos, KryptosRsa } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type CreateRsaSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: KryptosRsa;
};

export type VerifyRsaSignatureOptions = {
  data: string;
  format: BufferFormat;
  kryptos: KryptosRsa;
  signature: string;
};

export type RsaKitOptions = {
  format?: BufferFormat;
  kryptos: Kryptos;
};
