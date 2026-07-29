import { Matcher } from "@lindorm/match";
import type { Conduit } from "@lindorm/conduit";
import { type IKryptos, KryptosKit, type LindormJwk } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Environment } from "@lindorm/types";
import { AmphoraError } from "../../errors/index.js";
import type {
  AmphoraExternalConfig,
  AmphoraCondition,
  AmphoraSettings,
} from "../../types/index.js";
import { createExternalConduit } from "../utils/create-external-conduit.js";
import { fetchExternalJwks } from "../utils/fetch-external-jwks.js";
import { isEnvironment } from "../utils/is-environment.js";
import { resolveExternalConfig } from "../utils/resolve-external-config.js";
import { seedExternalConfig } from "../utils/seed-external-config.js";

/**
 * The ONE shared internal state behind an Amphora — a single Conduit, a single
 * logger, the single key vault — held by the class and by BOTH the `external`
 * and `idp` facets. Provenance (internal vs external vs idp) governs how keys
 * ENTER and REFRESH here; it never partitions the vault, so the class's unified
 * find/filter searches every key regardless of how it arrived.
 */
export class AmphoraState {
  readonly conduit: Conduit;
  readonly logger: ILogger;
  readonly domain: string | null;
  readonly environment: Environment | null;
  readonly maxExternalKeys: number;
  readonly maxIssuers: number;
  readonly refreshInterval: number;

  vault: Array<IKryptos> = [];
  externalConfigs: Array<AmphoraExternalConfig> = [];
  idpConfig: AmphoraExternalConfig | null = null;

  isSetup = false;
  setupPromise: Promise<void> | null = null;
  refreshPromise: Promise<void> | null = null;

  private _jwks: Array<LindormJwk> = [];
  private readonly issuerRefreshPromises = new Map<string, Promise<void>>();

  constructor(options: AmphoraSettings) {
    this.logger = options.logger.child(["Amphora"]);
    this.conduit = createExternalConduit(options, this.logger);

    this.domain = options.domain ?? null;
    this.environment = options.environment ?? null;
    this.maxExternalKeys = options.maxExternalKeys ?? 100;
    this.maxIssuers = options.maxIssuers ?? 1000;
    this.refreshInterval = options.refreshInterval ?? 300_000;

    if (options.idp) this.idpConfig = seedExternalConfig(options.idp);
    this.externalConfigs = (options.external ?? []).map(seedExternalConfig);
  }

  // getters

  get jwks(): Array<LindormJwk> {
    return this._jwks;
  }

  get hasExternal(): boolean {
    return this.externalConfigs.length > 0 || this.idpConfig !== null;
  }

  get allEntries(): Array<AmphoraExternalConfig> {
    return this.idpConfig
      ? [...this.externalConfigs, this.idpConfig]
      : [...this.externalConfigs];
  }

  // vault selection

  // `publish` gates SELECTION, but it means "belongs in OUR published JWKS" — and
  // an EXTERNAL key (`internal: false`) never does. So the default gate hides only
  // INTERNAL unpublished keys — the KEK / CA / cookie / session hazard. A caller
  // that NAMES `publish` opts out of the default gate entirely.
  filteredKeys(condition: AmphoraCondition): Array<IKryptos> {
    const active = this.vault.filter((i) => i.isActive);

    const matched = Matcher.filter<IKryptos>(active, condition);

    const gated =
      "publish" in condition ? matched : matched.filter((i) => !i.internal || i.publish);

    return gated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Unified, UNFILTERED lookup by id across the whole vault. kid uniqueness is
  // per-issuer, so an id can collide across issuers — return the most recent
  // (createdAt desc; Kryptos has no updatedAt) and warn, never throw or pick
  // arbitrarily.
  findByIdMostRecent(id: string): IKryptos | undefined {
    const matches = this.vault.filter((i) => i.id === id);

    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];

    const sorted = [...matches].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const selected = sorted[0];

    this.logger.warn(
      "Ambiguous findById: multiple keys share this id across issuers; returning most recent",
      {
        id,
        count: matches.length,
        issuers: matches.map((m) => m.issuer),
        selected: { issuer: selected.issuer, createdAt: selected.createdAt },
      },
    );

    return selected;
  }

  // LRU bookkeeping — bump the last-ACCESS time of every EXTERNAL issuer whose
  // key was just RETURNED to a caller (find / filter hit). This is the signal
  // `maxIssuers` eviction ranks by. The idp is deliberately not tracked: it is
  // exempt from the cap, so its recency never matters. Capability PROBES
  // (`canSign` etc.) go straight to `filteredKeys` and never reach here, so a
  // probe does not count as use.
  markAccessed(keys: Array<IKryptos>): void {
    if (keys.length === 0 || this.externalConfigs.length === 0) return;

    const now = new Date();

    for (const key of keys) {
      if (key.internal || !key.issuer) continue;

      const config = this.externalConfigs.find(
        (entry) => entry.issuer === key.issuer || entry.input.issuer === key.issuer,
      );
      if (config) config.lastAccess = now;
    }
  }

  // staleness — per issuer when the condition names one, else across all issuers.
  isStaleFor(condition: AmphoraCondition): boolean {
    const issuer = condition.issuer;

    if (typeof issuer === "string") {
      const entry = this.findEntry(issuer);
      if (!entry) return false;
      return this.entryStale(entry);
    }

    return this.allEntries.some((entry) => this.entryStale(entry));
  }

  private entryStale(entry: AmphoraExternalConfig): boolean {
    if (!entry.lastRefresh) return true;
    return Date.now() - entry.lastRefresh.getTime() > this.refreshInterval;
  }

  findEntry(issuer: string): AmphoraExternalConfig | undefined {
    return this.allEntries.find(
      (entry) => entry.issuer === issuer || entry.input.issuer === issuer,
    );
  }

  // The idp's resolved (or declared) issuer, if an idp is set.
  get idpIssuer(): string | null {
    if (!this.idpConfig) return null;
    return this.idpConfig.issuer ?? this.idpConfig.input.issuer ?? null;
  }

  // An issuer belongs to AT MOST one scope — it cannot be both the upstream `idp`
  // AND a peer `external` provider (one party, one role). Enforcing this keeps
  // issuer-scoped eviction unambiguous (evict-by-issuer never crosses scopes).
  // Called at REGISTRATION (input issuer) and at RESOLUTION (a discovery-derived
  // issuer, excluding the entry being resolved via `self`).
  assertIssuerScopeFree(
    issuer: string | null | undefined,
    scope: "external" | "idp",
    self?: AmphoraExternalConfig,
  ): void {
    if (!issuer) return;

    const holds = (entry: AmphoraExternalConfig): boolean =>
      entry !== self && (entry.issuer ?? entry.input.issuer) === issuer;

    const clash =
      scope === "idp"
        ? this.externalConfigs.some(holds)
        : this.idpConfig !== null && holds(this.idpConfig);

    if (clash) {
      throw new AmphoraError("Issuer is already registered in the other scope", {
        code: "issuer_scope_conflict",
        data: { issuer, scope },
        title: "Issuer Scope Conflict",
        details: `The issuer "${issuer}" is already registered as ${
          scope === "idp" ? "an external provider" : "the idp"
        }. An issuer belongs to exactly one scope — the idp OR external — not both.`,
      });
    }
  }

  // vault mutation

  // Cross-environment guard: reject a key whose leaf certificate declares an
  // Environment OU that differs from this Amphora's. Keys without a certificate,
  // or whose leaf OU is absent or a foreign (non-Environment) value, are
  // unrestricted.
  assertEnvironment(item: IKryptos): void {
    if (!this.environment || !item.hasCertificate) return;

    const ou = item.certificate?.subject.organizationalUnit;
    if (!isEnvironment(ou) || ou === this.environment) return;

    throw new AmphoraError("Kryptos certificate environment mismatch", {
      code: "environment_mismatch",
      data: { id: item.id, expected: this.environment, actual: ou },
      title: "Environment Mismatch",
      details: `The Kryptos "${item.id}" carries a certificate for the "${ou}" environment, which does not match this Amphora's "${this.environment}" environment.`,
    });
  }

  // Add OUR OWN keys (from `add` / `env`): stamp issuer/jwksUri from domain,
  // require issuer, reject expired, enforce the environment guard.
  addInternalKeys(array: Array<IKryptos>): void {
    for (const input of array) {
      if (!input.id) {
        throw new AmphoraError("Id is required when adding Kryptos", {
          code: "kryptos_id_required",
          title: "Kryptos ID Required",
          details: "Every Kryptos added to the vault must have an id.",
        });
      }

      const overwrite: Record<string, unknown> = {};

      if (!input.issuer && this.domain) {
        this.logger.silly("Setting issuer on Kryptos from domain", {
          id: input.id,
          issuer: this.domain,
        });
        overwrite.issuer = this.domain;
      }

      if (!input.jwksUri && this.domain) {
        const jwksUri = new URL("/.well-known/jwks.json", this.domain).toString();
        this.logger.silly("Setting jwksUri on Kryptos from domain", {
          id: input.id,
          jwksUri,
        });
        overwrite.jwksUri = jwksUri;
      }

      const item = Object.keys(overwrite).length
        ? KryptosKit.clone(input, overwrite)
        : input;

      if (!item.issuer) {
        throw new AmphoraError("Issuer is required when adding Kryptos", {
          code: "kryptos_issuer_required",
          data: { id: item.id },
          title: "Kryptos Issuer Required",
          details:
            "A Kryptos must have an issuer, either set explicitly or derived from the Amphora domain.",
        });
      }

      if (item.isExpired) {
        throw new AmphoraError("Kryptos is expired", {
          code: "kryptos_expired",
          data: { id: item.id, issuer: item.issuer, expiresAt: item.expiresAt },
          title: "Kryptos Expired",
          details: `The Kryptos "${item.id}" (issuer "${item.issuer}") expired at ${item.expiresAt?.toISOString()} and cannot be added to the vault.`,
        });
      }

      this.assertEnvironment(item);

      this.vault = this.vault.filter((i) => i.id !== item.id).concat(item);
    }

    this.refreshJwks();
  }

  // Add FOREIGN keys (via `external.add`): force `internal: false`, no domain
  // stamp — the provenance invariant for every key that enters an external scope.
  addExternalKeys(array: Array<IKryptos>): void {
    for (const input of array) {
      if (!input.id) {
        throw new AmphoraError("Id is required when adding Kryptos", {
          code: "kryptos_id_required",
          title: "Kryptos ID Required",
          details: "Every Kryptos added to the vault must have an id.",
        });
      }

      const item =
        input.internal === false ? input : KryptosKit.clone(input, { internal: false });

      this.vault = this.vault.filter((i) => i.id !== item.id).concat(item);
    }

    this.refreshJwks();
  }

  removeKey(id: string): void {
    this.vault = this.vault.filter((i) => i.id !== id);
    this.refreshJwks();
  }

  // Register a new EXTERNAL issuer source and enforce the cap. `lastAccess` is
  // stamped now — registration counts as use, so a just-registered issuer is
  // never the immediate eviction victim (only ever-idle peers are). The idp does
  // NOT flow through here (it is a singleton on `idpConfig`, exempt from the cap).
  addExternalConfig(config: AmphoraExternalConfig): void {
    config.lastAccess = new Date();
    this.externalConfigs.push(config);
    this.enforceIssuerCap();
  }

  // Hard, deterministic bound on the number of EXTERNAL issuers — evict the
  // least-recently-USED (smallest `lastAccess`; `null` = never used, sorts oldest)
  // until at or under `maxIssuers`. Inline on registration overflow, no background
  // sweeper. Correctness-safe: an evicted issuer re-registers + re-fetches on its
  // next use. The idp is not in `externalConfigs`, so it is never a candidate.
  private enforceIssuerCap(): void {
    while (this.externalConfigs.length > this.maxIssuers) {
      let victimIndex = 0;
      let victimTime = Infinity;

      this.externalConfigs.forEach((entry, index) => {
        const time = entry.lastAccess ? entry.lastAccess.getTime() : 0;
        if (time < victimTime) {
          victimTime = time;
          victimIndex = index;
        }
      });

      const [victim] = this.externalConfigs.splice(victimIndex, 1);
      const issuer = victim.issuer ?? victim.input.issuer ?? null;

      this.logger.warn(
        "Evicting least-recently-used external issuer (maxIssuers cap reached)",
        { issuer, maxIssuers: this.maxIssuers, lastAccess: victim.lastAccess },
      );

      this.evictIssuer(issuer);
    }
  }

  // Drop a foreign issuer's fetched keys — never our own (an env-imported key can
  // legitimately carry the same issuer and must survive).
  evictIssuer(issuer: string | null): void {
    if (!issuer) return;
    this.vault = this.vault.filter((i) => i.internal || i.issuer !== issuer);
    this.refreshJwks();
  }

  private applyFetchedKeys(config: AmphoraExternalConfig, keys: Array<IKryptos>): void {
    this.vault = this.vault
      .filter((i) => i.internal || i.issuer !== config.issuer)
      .concat(keys);
    config.keyCount = keys.length;
    config.lastRefresh = new Date();
    this.refreshJwks();
  }

  refreshJwks(): void {
    if (this.domain === null) return;

    this.logger.silly("Refreshing JWKS");

    this._jwks = Matcher.filter(this.vault, {
      hasPublicKey: true,
      publish: true,
      isExpired: false,
      // We publish OUR keys and only ours — republishing a key fetched from
      // someone else's JWKS would advertise their key material as our own.
      internal: true,
      issuer: this.domain,
    })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((i) => i.toJWK("public"));
  }

  // external fetch orchestration

  // Re-resolve one entry's config from its verbatim `input`, then fetch + apply
  // its keys. Used by targeted refresh and eager load.
  async loadEntry(config: AmphoraExternalConfig): Promise<void> {
    await this.resolveEntry(config);
    await this.fetchEntry(config);
  }

  private async resolveEntry(config: AmphoraExternalConfig): Promise<void> {
    const resolved = await resolveExternalConfig(this.conduit, config.input);

    // A discovery-derived issuer was unknown at registration; enforce scope
    // exclusivity now that it is settled (excluding this same entry).
    const scope = config === this.idpConfig ? "idp" : "external";
    this.assertIssuerScopeFree(resolved.issuer, scope, config);

    config.issuer = resolved.issuer;
    config.jwksUri = resolved.jwksUri;
    config.openIdConfiguration = resolved.openIdConfiguration;
    config.load = resolved.load;
  }

  private async fetchEntry(config: AmphoraExternalConfig): Promise<void> {
    const keys = await fetchExternalJwks(this.conduit, config, {
      maxExternalKeys: this.maxExternalKeys,
      logger: this.logger,
    });
    this.applyFetchedKeys(config, keys);
  }

  // Refetch EVERYTHING — idp + all external. Config resolution and key fetching
  // are each tolerant of partial failure; only a total wipe-out throws.
  async refreshAll(): Promise<void> {
    this.logger.silly("Refreshing vault");

    const entries = this.allEntries;
    if (entries.length === 0) return;

    const resolveResults = await Promise.allSettled(
      entries.map((entry) => this.resolveEntry(entry)),
    );

    let resolveFailures = 0;
    resolveResults.forEach((result, index) => {
      if (result.status === "rejected") {
        resolveFailures++;
        this.logger.warn("Failed to load external config", {
          error: result.reason,
          issuer: entries[index].input.issuer,
        });
      }
    });

    if (resolveFailures === entries.length) {
      throw new AmphoraError("All external config providers failed during refresh", {
        code: "external_config_providers_failed",
        data: { failed: resolveFailures, total: entries.length },
        title: "External Config Providers Failed",
        details: `All ${entries.length} external configuration provider(s) failed to load during refresh. Check provider availability and the openIdConfigurationUri/jwksUri endpoints.`,
      });
    }

    const resolved = entries.filter(
      (_, index) => resolveResults[index].status === "fulfilled",
    );

    const fetchResults = await Promise.allSettled(
      resolved.map((entry) => this.fetchEntry(entry)),
    );

    let fetchFailures = 0;
    for (const result of fetchResults) {
      if (result.status === "rejected") {
        fetchFailures++;
        this.logger.warn("Failed to refresh external JWKS", { error: result.reason });
      }
    }

    if (resolved.length > 0 && fetchFailures === resolved.length) {
      throw new AmphoraError("All external JWKS providers failed during refresh", {
        code: "external_jwks_providers_failed",
        data: { failed: fetchFailures, total: resolved.length },
        title: "External JWKS Providers Failed",
        details: `All ${resolved.length} external JWKS provider(s) failed to return usable keys during refresh. Check provider availability and the JWKS endpoints.`,
      });
    }
  }

  refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async (): Promise<void> => {
      try {
        await this.refreshAll();
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Targeted refetch of ONE issuer (deduplicated per issuer). A no-op when no
  // external entry owns the issuer — the granular find-miss path can pass a
  // local-only issuer, which simply has nothing to refetch.
  refreshIssuer(issuer: string): Promise<void> {
    const config = this.findEntry(issuer);
    if (!config) return Promise.resolve();

    const existing = this.issuerRefreshPromises.get(issuer);
    if (existing) return existing;

    const promise = (async (): Promise<void> => {
      try {
        await this.loadEntry(config);
      } finally {
        this.issuerRefreshPromises.delete(issuer);
      }
    })();

    this.issuerRefreshPromises.set(issuer, promise);
    return promise;
  }

  refreshFor(condition: AmphoraCondition): Promise<void> {
    const issuer = condition.issuer;
    return typeof issuer === "string" ? this.refreshIssuer(issuer) : this.refresh();
  }
}
