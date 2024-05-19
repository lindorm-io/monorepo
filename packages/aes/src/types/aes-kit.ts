import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";

export type AesKitOptions = {
  encryption?: KryptosEncryption;
  format?: BufferFormat;
  kryptos: IKryptos;
};
