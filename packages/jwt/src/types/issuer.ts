import { Keystore, KeyType } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/winston";

export interface IssuerOptions {
  clockTolerance?: number;
  issuer: string;
  keyType?: KeyType;
  keystore: Keystore;
  logger: Logger;
}
