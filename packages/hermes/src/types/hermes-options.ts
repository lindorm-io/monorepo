import type { IIrisSource } from "@lindorm/iris";
import type { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { ReadableTime } from "@lindorm/date";
import type { HermesScannerInput } from "../internal/registry/types.js";

export type ChecksumMode = "strict" | "warn";

export type HermesOptions = {
  proteus: IProteusSource;
  viewSources?: Array<IProteusSource>;
  iris: IIrisSource;
  modules: HermesScannerInput;
  logger: ILogger;
  namespace?: string;
  encryption?: {
    algorithm?: KryptosEncAlgorithm;
    encryption?: KryptosEncryption;
  };
  checksumMode?: ChecksumMode;
  causationExpiry?: ReadableTime;
};
