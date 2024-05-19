import {
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { IAegisVault } from "./interfaces";

export type AegisOptions = {
  clockTolerance?: number;
  encAlgorithm?: KryptosEncAlgorithm;
  encryption?: KryptosEncryption;
  issuer: string;
  kryptosMayOverrideEncryption?: boolean;
  logger: ILogger;
  sigAlgorithm?: KryptosSigAlgorithm;
  vault: IAegisVault;
};
