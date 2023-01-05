import { Keystore, KeyType } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/core-logger";

export interface JwtOptions {
  clockTolerance?: number;
  issuer: string;
  keyType?: KeyType;
  keystore: Keystore;
  logger: Logger;
}
