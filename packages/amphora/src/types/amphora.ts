import { KryptosAttributes, KryptosMetadata, LindormJwk } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { OpenIdConfiguration } from "@lindorm/types";
import { Predicate } from "@lindorm/utils";

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
  external?: Array<AmphoraExternalOption>;
  issuer?: string;
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
