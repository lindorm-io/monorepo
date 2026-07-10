import type { KryptosAttributes, KryptosMetadata, LindormJwk } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Environment, OpenIdConfiguration, Predicate } from "@lindorm/types";

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
  // When set, keys whose leaf certificate declares a DIFFERENT Environment OU are
  // rejected on add (cross-environment guard). Keys without a cert, or with a
  // non-Environment (foreign) OU, are unrestricted.
  environment?: Environment;
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
