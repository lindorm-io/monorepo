import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { CertificateBindingMode } from "./header.js";

export type SignKitSettings = {
  certBindingMode?: CertificateBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
};

export type EncryptKitSettings = SignKitSettings & {
  encryption?: KryptosEncryption;
};
