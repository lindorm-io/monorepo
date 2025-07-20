import { KryptosAttributes, KryptosMetadata, LindormJwk } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { OpenIdConfiguration, Predicate } from "@lindorm/types";

export type AmphoraConfig = Partial<OpenIdConfiguration> & {
  issuer: string;
  jwksUri: string;
  openIdConfigurationUri?: string;
};

export type AmphoraExternalOption = {
  issuer?: string;
  jwksUri?: string;
  openIdConfiguration?: Partial<OpenIdConfiguration>;
  openIdConfigurationUri?: string;
};

export type AmphoraOptions = {
  domain?: string;
  external?: Array<AmphoraExternalOption>;
  logger: ILogger;
};

export type AmphoraQuery = Predicate<
  Pick<
    KryptosAttributes & KryptosMetadata,
    | "id"
    | "algorithm"
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
  >
>;

export type AmphoraJwks = {
  keys: Array<LindormJwk>;
};
