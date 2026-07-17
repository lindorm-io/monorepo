import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { CertBindingMode } from "./header.js";

export type SignKitSettings = {
  certBindingMode?: CertBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
};

export type EncryptKitSettings = SignKitSettings & {
  encryption?: KryptosEncryption;
};
