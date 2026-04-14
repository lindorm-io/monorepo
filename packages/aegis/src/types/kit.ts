import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { CertBindingMode } from "./header";

export type SignKitOptions = {
  certBindingMode?: CertBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
};

export type EncryptKitOptions = SignKitOptions & {
  encryption?: KryptosEncryption;
};
