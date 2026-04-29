import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { CertBindingMode } from "./header.js";

export type SignKitOptions = {
  certBindingMode?: CertBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
};

export type EncryptKitOptions = SignKitOptions & {
  encryption?: KryptosEncryption;
};
