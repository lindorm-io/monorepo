import { IAmphora } from "@lindorm/amphora";
import {
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type AegisOptions = {
  amphora: IAmphora;
  clockTolerance?: number;
  encAlgorithm?: KryptosEncAlgorithm;
  encryption?: KryptosEncryption;
  issuer: string;
  kryptosMayOverrideEncryption?: boolean;
  logger: ILogger;
  sigAlgorithm?: KryptosSigAlgorithm;
};
