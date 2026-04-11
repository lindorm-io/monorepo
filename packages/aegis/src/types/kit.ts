import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type SignKitOptions = {
  kryptos: IKryptos;
  logger: ILogger;
};

export type EncryptKitOptions = SignKitOptions & {
  encryption?: KryptosEncryption;
};
