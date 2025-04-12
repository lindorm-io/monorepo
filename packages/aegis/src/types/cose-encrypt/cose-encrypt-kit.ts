import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type CoseEncryptContent = Buffer | string;

export type CoseEncryptKitOptions = {
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
  logger: ILogger;
};
