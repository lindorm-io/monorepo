import type {
  IKryptos,
  KryptosAttributes,
  KryptosMetadata,
  LindormJwk,
} from "@lindorm/kryptos";
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

/**
 * How a consumer NAMES the key it wants: an explicit key, or a query for one.
 *
 * This is the single key-selection vocabulary across the toolkit — aegis, iris,
 * proteus and pylon all take this shape, so "which key does this?" is answered
 * the same way everywhere.
 *
 * - `kryptos` — a key supplied outright. Typically an env-imported KEK
 *   (`KryptosKit.env.import(process.env.KEK!)`), which is available at module
 *   load, so it can be handed to a decorator. It never came from the vault, so a
 *   `predicate` is meaningless for it — but the consuming library's FLOOR still
 *   applies, which is what makes an injected key safe rather than an escape hatch.
 * - `predicate` — which of the vault's keys.
 *
 * `TPredicate` is narrowed by each consumer to exclude the attributes IT owns as
 * a floor (aegis excludes `use` / `hasPrivateKey`; the at-rest encryption
 * libraries do the same), so a caller cannot express — let alone widen — an
 * invariant the library is responsible for.
 */
export type AmphoraKeySelector<TPredicate = AmphoraPredicate> = {
  kryptos?: IKryptos;
  predicate?: TPredicate;
};

export type AmphoraQuery = Pick<
  KryptosAttributes & KryptosMetadata,
  | "id"
  | "algClass"
  | "algorithm"
  | "certificateThumbprint"
  | "curve"
  | "encryption"
  | "hasPrivateKey"
  | "hasPublicKey"
  | "internal"
  | "issuer"
  | "operations"
  | "ownerId"
  | "publish"
  | "purpose"
  | "type"
  | "use"
>;

export type AmphoraJwks = {
  keys: Array<LindormJwk>;
};
