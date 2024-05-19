import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type JwsContent = Buffer | string;

export type JwsKitOptions = {
  logger: ILogger;
  kryptos: IKryptos;
};
