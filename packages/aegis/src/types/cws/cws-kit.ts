import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type CwsContent = Buffer | string;

export type CwsKitOptions = {
  logger: ILogger;
  kryptos: IKryptos;
};
