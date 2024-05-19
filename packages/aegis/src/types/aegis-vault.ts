import { KryptosOperation, KryptosType, KryptosUse } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";

export type VaultConfig = {
  issuer: string;
  jwksUri: string;
};

export type VaultExternalOption = {
  issuer?: string;
  openIdConfigurationUri?: string;
  jwksUri?: string;
};

export type AegisVaultOptions = {
  external?: Array<VaultExternalOption>;
  logger: ILogger;
};

export type AegisVaultQueryKey = "private" | "public";

export type AegisVaultQuery = {
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
