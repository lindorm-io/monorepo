import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type CoseSignContent = Buffer | string;

export type CoseSignKitOptions = {
  logger: ILogger;
  kryptos: IKryptos;
};
