import { KryptosAttributes, KryptosMetadata, LindormJwk } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { OpenIdConfiguration, Predicate } from "@lindorm/types";

export type AmphoraConfig = Partial<OpenIdConfiguration> & {
  issuer: string;
  jwksUri: string;
  openIdConfigurationUri?: string;
  trustAnchors?: string | Array<string>;
  trustMode?: "strict" | "lax";
};

export type AmphoraExternalOption = {
  issuer?: string;
  jwksUri?: string;
  openIdConfiguration?: Partial<OpenIdConfiguration>;
  openIdConfigurationUri?: string;
  trustAnchors?: string | Array<string>;
  trustMode?: "strict" | "lax";
};

export type AmphoraOptions = {
  domain?: string;
  external?: Array<AmphoraExternalOption>;
  logger: ILogger;
  maxExternalKeys?: number;
  refreshInterval?: number;
};

export type AmphoraPredicate = Predicate<AmphoraQuery>;

export type AmphoraQuery = Pick<
  KryptosAttributes & KryptosMetadata,
  | "id"
  | "algorithm"
  | "certificateThumbprint"
  | "curve"
  | "encryption"
  | "hasPrivateKey"
  | "hasPublicKey"
  | "isExternal"
  | "issuer"
  | "operations"
  | "ownerId"
  | "purpose"
  | "type"
  | "use"
>;

export type AmphoraJwks = {
  keys: Array<LindormJwk>;
};
