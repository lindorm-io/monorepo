import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";

export type AesKitOptions = {
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
};
