import type { IIrisSource } from "@lindorm/iris";
import type { KryptosEncAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { ReadableTime } from "@lindorm/date";
import type { HermesScannerInput } from "../internal/registry/types.js";

export type ChecksumMode = "strict" | "warn";

export type HermesSettings = {
  proteus: IProteusSource;
  viewSources?: Array<IProteusSource>;
  /** Optional separate source for the per-aggregate DEK (EncryptionRecord). Defaults to `proteus`.
   *  Routing it to a different store means a single-store dump no longer yields ciphertext + key together. */
  encryptionSource?: IProteusSource;
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
