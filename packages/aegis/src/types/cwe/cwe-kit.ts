import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type CweContent = Buffer | string;

export type CweKitOptions = {
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
  logger: ILogger;
};
