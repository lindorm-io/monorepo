import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type JwtKitOptions = {
  clockTolerance?: number;
  issuer?: string;
  logger: ILogger;
  kryptos: IKryptos;
};
