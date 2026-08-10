import type { Condition } from "@lindorm/match";
import type { ConduitLookup } from "@lindorm/conduit";
import type {
  IKryptos,
  KryptosAttributes,
  KryptosMetadata,
  LindormJwk,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { OpenIdConfiguration } from "@lindorm/openid";
import type { Environment } from "@lindorm/types";

/** The service's OWN identity — minimal (it IS the issuer; it never discovers itself). */
export type AmphoraInternalConfig = {
  issuer: string;
  /**
   * `{issuer}/.well-known/jwks.json` — `null` unless the issuer is an http(s)
   * URL. A URN names the service without saying where to reach it, and any other
   * scheme names somewhere nothing can fetch from, so there is nothing to derive.
   */
  jwksUri: string | null;
};

/**
 * The service's OWN issuer scope. The BLOCK is optional — omit it for a service
 * that only VERIFIES (it then has no identity of its own, and `amphora.jwks`
 * throws) — but an issuer is what the block IS, so within it, it is required.
 */
export type AmphoraInternalSettings = {
  /**
   * The service's OWN issuer — the URI it mints tokens under. It stamps `issuer`
   * and `jwksUri` on every key added via `add` / `env`, it is the filter deciding
   * which keys `amphora.jwks` publishes, and it is what `amphora.internal` is
   * derived from.
   *
   * A URI on the same terms as an external issuer: a URL with an authority
   * (`https://…`) or a URN (`urn:…`), never a bare or opaque identifier
   * (`internal_issuer_not_uri`). Key resolution scopes by issuer only when the
   * issuer is a URI, so anything looser would quietly cost this service scoping
   * for its own tokens. Only an http(s) URL issuer derives a `jwksUri` — a URN
   * (or any other scheme) names no location to publish keys at.
   */
  issuer: string;
};

export type AmphoraExternalSettings = {
  issuer?: string;
  jwksUri?: string;
  /**
   * Override or supplement values from the discovery document — a PARTIAL by
   * design: an operator patching a single member (an endpoint the provider
   * serves but does not advertise) supplies that member alone.
   */
  openIdConfiguration?: Partial<OpenIdConfiguration>;
  openIdConfigurationUri?: string;
  /**
   * Whether a failed fetch is FATAL. It does not say WHEN the fetch happens —
   * every DECLARED issuer is fetched at `setup()`, always.
   *
   * - `true` — `setup()` THROWS when this issuer cannot be resolved or its keys
   *   cannot be fetched. Boot fails on the real cause rather than deferring an
   *   unusable provider to a user's first request.
   * - `false` (default) — the first failure is logged as a `warn`, setup
   *   completes, and the issuer is retried on the schedule below.
   *
   * ⚠ RETRY IS EXPLICIT, not a property of the refresh interval. A failed load
   * stamps the issuer with a retry time of now + `refreshInterval`, and no
   * SPECULATIVE refetch happens before it. Saying "the refresh interval is the
   * backoff" was false while an issuer that had NEVER succeeded counted as
   * permanently stale: it had no last-refresh instant for an interval to be
   * measured from, so every unscoped lookup re-attempted it immediately, without
   * bound and with no clock movement.
   *
   * A MISS is never gated by that stamp — a provider that was failing and has
   * since rotated a key is fetched on the spot, not after the backoff.
   *
   * Either way REFRESH is tolerant: an issuer that resolved at boot and later
   * fails a refresh keeps its working config and keys, and never takes a healthy
   * running process down.
   *
   * `required` is meaningful only for a DECLARED source (the constructor
   * `external` array), because only those are in the `setup()` sweep. An issuer
   * registered through `external.addIssuer` reports its own failure by throwing
   * from that call.
   */
  required?: boolean;
  trustAnchors?: string | Array<string>;
  trustMode?: "strict" | "lax";
};

/**
 * The UPSTREAM identity provider's source — an external issuer source MINUS
 * `required`, because the idp is ALWAYS required.
 *
 * A relying party cannot verify a single token from its own upstream without
 * that provider's discovery document, so there is no deployment in which a
 * missing idp is survivable. Making it a flag would only offer a way to declare
 * something untrue.
 */
export type AmphoraIdpSettings = Omit<AmphoraExternalSettings, "required">;

/**
 * A RESOLVED external issuer config — returned by `external.issuers()` and
 * `idp.config()`. `input` keeps the original declared options verbatim (the
 * source-of-truth for re-resolution); every other field is derived cache,
 * re-resolved from `input` on refresh. `issuer` / `jwksUri` fill in from `input` OR a
 * fetched discovery doc; `openIdConfiguration` is that fetched doc (NESTED, not flattened).
 *
 * ⚠ `issuer` is a `string`, not a nullable one: amphora scopes, verifies (`jwk.iss`)
 * and evicts keys BY issuer, so a config without one is not a config. The nullable,
 * still-resolving shape is amphora-internal and never reaches this type — a source
 * that names no issuer is rejected at REGISTRATION, a discovery document that yields
 * none throws at RESOLUTION, and a source registered by `openIdConfigurationUri` alone
 * that has not resolved yet is simply not an issuer yet (`external.issuers()` lists it
 * once it is; `idp.config()` throws `idp_issuer_unresolved` until then).
 */
export type AmphoraExternalConfig = {
  input: AmphoraExternalSettings;
  /**
   * Whether a failed fetch is fatal at `setup()` — `input.required ?? false` for
   * an external issuer, and always `true` for the idp.
   */
  required: boolean;
  issuer: string;
  /**
   * Nullable ON PURPOSE, unlike `issuer`: an issuer's keys can be handed to amphora
   * outright via `external.add(kryptos)`, with no URI anywhere. The consumer that
   * needs to FETCH is the one that should complain, and `fetchExternalJwks` does
   * (`external_jwks_uri_missing`).
   */
  jwksUri: string | null;
  /**
   * The fetched discovery document, merged with the declared override. PARTIAL:
   * amphora neither validates it nor reads more than `issuer` / `jwksUri`, so
   * claiming the members the specs mark REQUIRED would be a claim amphora has
   * not checked. A consumer that needs a complete {@link OpenIdConfiguration}
   * validates it at ITS boundary (pylon's `getOpenIdConfiguration` does exactly
   * that, and throws `openid_configuration_incomplete` when it cannot).
   *
   * A non-standard member a provider emits survives at RUNTIME — the document
   * is spread verbatim — but reading one is a deliberate, greppable cast: the
   * `OpenIdConfiguration` shape is closed so a mistyped member cannot pass silently.
   */
  openIdConfiguration: Partial<OpenIdConfiguration> | null;
  keyCount: number;
  /** Last SUCCESSFUL fetch. `null` until this issuer's keys have landed once. */
  lastRefresh: Date | null;
  // Last time a key from this issuer was RETURNED by a find/filter — the LRU
  // signal for `maxIssuers` eviction. `null` until first use: a never-used
  // external issuer is the first to be evicted under cap pressure. The idp is
  // exempt from the cap, so its `lastAccess` is never consulted.
  lastAccess: Date | null;
};

export type AmphoraSettings = {
  // When set, keys whose leaf certificate declares a DIFFERENT Environment OU are
  // rejected on add (cross-environment guard). Keys without a cert, or with a
  // non-Environment (foreign) OU, are unrestricted.
  environment?: Environment;
  external?: Array<AmphoraExternalSettings>;
  /**
   * The single UPSTREAM identity provider — a distinguished singleton external
   * issuer, always `required`. `setup()` throws when it cannot be resolved.
   */
  idp?: AmphoraIdpSettings;
  /** The service's OWN issuer scope. See {@link AmphoraInternalSettings}. */
  internal?: AmphoraInternalSettings;
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
   * (LRU by the last find/filter hit; a never-used issuer goes first). This
   * bounds the vault against CLIENT-driven growth (e.g. one issuer per DCR
   * `jwks_uri` client), which is the memory-exhaustion vector the cap closes;
   * the trigger is `addIssuer` overflow, so operator-declared `external` from
   * construction is never trimmed until dynamic registration begins.
   * Defaults to 1000.
   *
   * ⚠ EVICTION DOES NOT SELF-HEAL. An evicted issuer is gone: amphora holds no
   * source for it, so a later lookup for its keys fails and nothing refetches
   * it — a targeted refresh finds no entry and no-ops. Re-registering is the
   * CONSUMER's job, and the consumers that rely on the cap already do it
   * naturally: call `external.addIssuer` before the lookup that needs the
   * issuer, which is what a per-request registration flow does on every request
   * anyway.
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
  /**
   * Per-fetch HTTP timeout, in milliseconds, for external discovery / JWKS
   * fetches — forwarded to the internal Conduit. Defaults to `10000`.
   *
   * It bounds ONE attempt, and the Conduit retries up to three times, so the
   * worst case of a single load is roughly three times this plus backoff. That
   * matters because a load is not only a background sweep: `external.addIssuer`
   * resolves and fetches INLINE, so on a service that registers issuers per
   * request this value sits directly in a request's wall clock. Lower it there.
   *
   * Instance-level rather than per-source, like {@link ConduitLookup} and
   * `maxRedirects`: one Conduit serves every source, and two sources on one
   * amphora needing different timeouts are better served by two amphoras — which
   * is also how the boot-sweep and per-request roles are actually deployed.
   */
  timeout?: number;
};

export type AmphoraCondition = Condition<AmphoraQuery>;

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
 *   `condition` is meaningless for it — but the consuming library's FLOOR still
 *   applies, which is what makes an injected key safe rather than an escape hatch.
 * - `condition` — which of the vault's keys.
 *
 * `TCondition` is narrowed by each consumer to exclude the attributes IT owns as
 * a floor (aegis excludes `use` / `hasPrivateKey`; the at-rest encryption
 * libraries do the same), so a caller cannot express — let alone widen — an
 * invariant the library is responsible for.
 */
export type AmphoraKeySelector<TCondition = AmphoraCondition> = {
  kryptos?: IKryptos;
  condition?: TCondition;
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
  // TIME policy as a condition. `filteredKeys` already drops inactive keys from a
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
