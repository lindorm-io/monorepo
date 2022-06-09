import { Keystore, KeyType } from "@lindorm-io/key-pair";
import { ILogger } from "@lindorm-io/winston";

export interface JwtOptions {
  clockTolerance?: number;
  issuer: string;
  keyType?: KeyType;
  keystore: Keystore;
  logger: ILogger;
}
