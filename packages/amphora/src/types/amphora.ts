import { KryptosOperation, KryptosType, KryptosUse, LindormJwk } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type AmphoraConfig = {
  issuer: string;
  jwksUri: string;
};

export type AmphoraExternalOption = {
  issuer?: string;
  jwksUri?: string;
  openIdConfigurationUri?: string;
};

export type AmphoraOptions = {
  external?: Array<AmphoraExternalOption>;
  issuer: string;
  logger: ILogger;
};

export type AmphoraQuery = {
  id?: string;
  algorithm?: string;
  external?: boolean;
  issuer?: string;
  operation?: KryptosOperation;
  ownerId?: string;
  private?: boolean;
  public?: boolean;
  type?: KryptosType;
  use?: KryptosUse;
};

export type AmphoraJwks = {
  keys: Array<LindormJwk>;
};
