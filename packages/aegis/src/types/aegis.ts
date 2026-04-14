import { AmphoraQuery, IAmphora } from "@lindorm/amphora";
import {
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Predicate } from "@lindorm/types";
import { CertBindingMode } from "./header";

export type AegisPredicate = Predicate<
  Pick<AmphoraQuery, "id" | "curve" | "purpose" | "type" | "use" | "ownerId">
>;

export type AegisOptions = {
  amphora: IAmphora;
  certBindingMode?: CertBindingMode;
  clockTolerance?: number;
  dpopMaxSkew?: number;
  encAlgorithm?: KryptosEncAlgorithm;
  encryption?: KryptosEncryption;
  issuer?: string;
  logger: ILogger;
  sigAlgorithm?: KryptosSigAlgorithm;
};
