import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";

export type AesKitSettings = {
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
};
