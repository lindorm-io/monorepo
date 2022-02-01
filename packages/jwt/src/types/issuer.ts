import { Keystore } from "@lindorm-io/key-pair";
import { Logger } from "@lindorm-io/winston";

export interface IssuerOptions {
  clockTolerance?: number;
  issuer: string;
  keystore: Keystore;
  logger: Logger;
}
