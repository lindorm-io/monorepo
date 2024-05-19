import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type JweKitOptions = {
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
  kryptosMayOverrideEncryption?: boolean;
  logger: ILogger;
};
