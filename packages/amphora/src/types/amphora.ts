import type { ConduitLookup } from "@lindorm/conduit";
import type {
  IKryptos,
  KryptosAttributes,
  KryptosMetadata,
  LindormJwk,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Environment, OpenIdConfiguration, Predicate } from "@lindorm/types";

/** The service's OWN identity — minimal (it IS the issuer; it never discovers itself). */
export type AmphoraInternalConfig = {
  issuer: string;
  jwksUri: string;
};

export type AmphoraExternalSettings = {
  issuer?: string;
  jwksUri?: string;
  openIdConfiguration?: Partial<OpenIdConfiguration>;
  openIdConfigurationUri?: string;
  /**
   * Eager-fetch this issuer's keys on `addIssuer` / `idp.set` (await the fetch), vs
   * lazy (registered now, fetched on the next refresh or the first `find`-miss).
   * Default `false` (lazy) — the per-issuer miss-refresh makes first use cheap.
   */
  load?: boolean;
  trustAnchors?: string | Array<string>;
  trustMode?: "strict" | "lax";
};

/**
 * A resolved + progressively-ENRICHED external issuer config — returned by
 * `external.issuers()` and `idp.config()`. `input` keeps the original declared options
 * verbatim (the source-of-truth for re-resolution); every other field is derived cache,
 * re-resolved from `input` on refresh. `issuer` / `jwksUri` fill in from `input` OR a
 * fetched discovery doc; `openIdConfiguration` is that fetched doc (NESTED, not flattened).
 */
export type AmphoraExternalConfig = {
  input: AmphoraExternalSettings;
  load: boolean;
  issuer: string | null;
  jwksUri: string | null;
  openIdConfiguration: OpenIdConfiguration | null;
  keyCount: number;
  lastRefresh: Date | null;
  // Last time a key from this issuer was RETURNED by a find/filter — the LRU
  // signal for `maxIssuers` eviction. `null` until first use: a never-used
  // external issuer is the first to be evicted under cap pressure. The idp is
  // exempt from the cap, so its `lastAccess` is never consulted.
  lastAccess: Date | null;
};

export type AmphoraSettings = {
  domain?: string;
  // When set, keys whose leaf certificate declares a DIFFERENT Environment OU are
  // rejected on add (cross-environment guard). Keys without a cert, or with a
  // non-Environment (foreign) OU, are unrestricted.
  environment?: Environment;
  external?: Array<AmphoraExternalSettings>;
  /** The single UPSTREAM identity provider — a distinguished singleton external issuer. */
  idp?: AmphoraExternalSettings;
  logger: ILogger;
  /**
   * DNS resolver hook for external discovery/JWKS fetches — forwarded to the
   * internal Conduit's `lookup`. The seam for SSRF IP-pinning: supply a resolver
   * that validates each resolved address against an egress policy and returns
   * the vetted IP, so the fetch connects to exactly that address (closing the
   * check-time/connect-time DNS-rebinding gap the `maxRedirects: 0` default does
   * not). Omit for ordinary DNS. See {@link ConduitLookup}.
   */
  lookup?: ConduitLookup;
  maxExternalKeys?: number;
  /**
   * Hard cap on the number of EXTERNAL issuers held at once — the idp is EXEMPT
   * (it is a distinguished singleton). Registering past the cap via
   * `external.addIssuer` evicts the least-recently-USED external issuer inline
   * (LRU by the last find/filter hit; a never-used issuer goes first). Eviction
   * is correctness-safe — an evicted issuer re-registers and re-fetches on its
   * next use. This bounds the vault against CLIENT-driven growth (e.g. one issuer
   * per DCR `jwks_uri` client), which is the memory-exhaustion vector the cap
   * closes; the trigger is `addIssuer` overflow, so operator-declared `external`
   * from construction is never trimmed until dynamic registration begins.
   * Defaults to 1000.
   */
  maxIssuers?: number;
  /**
   * Max HTTP redirects amphora follows when fetching an EXTERNAL provider's
   * discovery / JWKS document. Defaults to `0`: a JWKS or OIDC discovery
   * endpoint has no legitimate reason to redirect, and following one lets a
   * `jwks_uri` that already passed a caller's SSRF egress guard 302 to an
   * internal host AFTER the check (defeating the guard). Raise it only for a
   * provider you explicitly trust to redirect.
   */
  maxRedirects?: number;
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
  // The lifetime states — pending → active → expired — so a consumer can state a
  // TIME policy as a predicate. `filteredKeys` already drops inactive keys from a
  // QUERY, but `findById` is unfiltered by design and an injected key never
  // touches the vault at all: without these, neither could be time-checked.
  | "isActive"
  | "isExpired"
  | "isPending"
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
