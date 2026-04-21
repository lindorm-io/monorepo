import type { AmphoraQuery, IAmphora } from "@lindorm/amphora";
import type {
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Predicate } from "@lindorm/types";
import type { CertBindingMode } from "./header.js";

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
