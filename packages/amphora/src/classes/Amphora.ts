import { Conduit, conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { isArray, isString, isUrlLike } from "@lindorm/is";
import { type IKryptos, KryptosKit, type LindormJwk } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type {
  Environment,
  OpenIdConfigurationResponse,
  OpenIdJwksResponse,
} from "@lindorm/types";
import { Predicated } from "@lindorm/utils";
import { AmphoraError } from "../errors/index.js";
import type { IAmphora } from "../interfaces/index.js";
import type {
  AmphoraConfig,
  AmphoraExternalOption,
  AmphoraJwks,
  AmphoraOptions,
  AmphoraPredicate,
} from "../types/index.js";
import { isEnvironment } from "../utils/is-environment.js";

const OIDCONF = "/.well-known/openid-configuration" as const;

export class Amphora implements IAmphora {
  readonly domain: string | null;

  private readonly conduit: Conduit;
  private readonly environment: Environment | null;
  private readonly logger: ILogger;
  private readonly maxExternalKeys: number;
  private readonly refreshInterval: number;

  private _config: Array<AmphoraConfig>;
  private _external: Array<AmphoraExternalOption>;
  private _jwks: Array<LindormJwk>;
  private _lastRefresh: Date | null = null;
  private _refreshPromise: Promise<void> | null = null;
  private _setup: boolean;
  private _setupPromise: Promise<void> | null = null;
  private _vault: Array<IKryptos>;

  constructor(options: AmphoraOptions) {
    this.logger = options.logger.child(["Amphora"]);

    this.conduit = new Conduit({
      alias: "Amphora",
      logger: this.logger,
      middleware: [conduitChangeResponseDataMiddleware()],
      retryOptions: { maxAttempts: 3 },
      timeout: 10000,
    });

    this._config = [];
    this._external = options.external ?? [];
    this._jwks = [];
    this._setup = false;
    this._vault = [];

    this.domain = options.domain ?? null;
    this.environment = options.environment ?? null;
    this.maxExternalKeys = options.maxExternalKeys ?? 100;
    this.refreshInterval = options.refreshInterval ?? 300_000;

    if (this.domain && !isUrlLike(this.domain)) {
      throw new AmphoraError("Domain must be a valid URL", {
        code: "invalid_domain_url",
        data: { domain: this.domain },
        title: "Invalid Domain URL",
        details: `The configured domain "${this.domain as string}" is not a valid URL. Provide a fully-qualified URL such as https://example.com.`,
      });
    }
  }

  // public getters

  get config(): Array<AmphoraConfig> {
    return [...this._config];
  }

  get jwks(): AmphoraJwks {
    if (!this.domain) {
      throw new AmphoraError("Domain is required to get JWKS", {
        code: "domain_required_for_jwks",
        title: "Domain Required For JWKS",
        details:
          "Domain is used to determine the signing issuer of the keys. If your server signs tokens, it must have a domain.",
      });
    }

    return { keys: [...this._jwks] };
  }

  get vault(): Array<IKryptos> {
    return [...this._vault];
  }

  // private getters

  private get isStale(): boolean {
    if (!this._lastRefresh) return true;
    return Date.now() - this._lastRefresh.getTime() > this.refreshInterval;
  }

  // public setup

  async setup(): Promise<void> {
    if (this._setup) return;
    if (this._setupPromise) return this._setupPromise;

    this._setupPromise = (async (): Promise<void> => {
      this.mapExternalOptions();
      await this.refresh();
      this._setup = true;
    })();

    try {
      await this._setupPromise;
    } finally {
      this._setupPromise = null;
    }
  }

  // public methods

  add(kryptos: Array<IKryptos> | IKryptos): void {
    const array = isArray(kryptos) ? kryptos : [kryptos];

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

      this._vault = this._vault.filter((i) => i.id !== item.id).concat(item);
    }

    this.refreshJwks();
  }

  env(keys: Array<string> | string): void {
    const array = isArray(keys) ? keys : [keys];

    const result: Array<IKryptos> = [];

    for (const key of array) {
      const kryptos = KryptosKit.env.import(key);

      // Env-imported keys are our own (`internal: true`) and feed the JWKS when
      // public + `publish: true` — an issuer that differs from this Amphora's
      // domain would never be served, which is almost certainly a config error.
      if (this.domain && kryptos.issuer && kryptos.issuer !== this.domain) {
        this.logger.warn("Env-imported key issuer differs from amphora domain", {
          domain: this.domain,
          issuer: kryptos.issuer,
          kid: kryptos.id,
        });
      }

      result.push(kryptos);
    }

    this.add(result);
  }

  // Cross-environment guard: reject a key whose leaf certificate declares an
  // Environment OU that differs from this Amphora's. Keys without a certificate
  // (oct KEKs etc.), or whose leaf OU is absent or a foreign (non-Environment)
  // value, are unrestricted.
  private assertEnvironment(item: IKryptos): void {
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

  async filter(predicate: AmphoraPredicate): Promise<Array<IKryptos>> {
    if (!this._setup && this._external.length) {
      await this.setup();
    }

    const filtered = this.filteredKeys(predicate);

    if (filtered.length && !this.isStale) return filtered;

    await this.refresh();

    return this.filteredKeys(predicate);
  }

  filterSync(predicate: AmphoraPredicate): Array<IKryptos> {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
        {
          code: this._setupPromise ? "setup_in_progress" : "setup_required_for_sync",
          data: { externalProviders: this._external.length },
          title: this._setupPromise ? "Setup In Progress" : "Setup Required For Sync",
          details: this._setupPromise
            ? "Amphora setup() is currently running; await setup() to finish before calling synchronous methods."
            : "External providers are configured, so setup() must complete before synchronous methods can be used. Call and await setup() first.",
        },
      );
    }

    return this.filteredKeys(predicate);
  }

  async find(predicate: AmphoraPredicate): Promise<IKryptos> {
    const [key] = await this.filter(predicate);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query after refresh", {
      code: "kryptos_not_found_by_query_after_refresh",
      data: {
        queryKeys: Object.keys(predicate),
        totalKeys: this._vault.length,
        activeKeys: this._vault.filter((i) => i.isActive).length,
      },
      title: "Kryptos Not Found By Query After Refresh",
      details: `No active Kryptos matched the query (${Object.keys(predicate).join(", ")}) even after refreshing external providers. Verify the query and that a matching key exists.`,
    });
  }

  async findById(id: string): Promise<IKryptos> {
    const existing = this._vault.find((i) => i.id === id);
    if (existing) return existing;

    if (this._external.length) {
      await this.refresh();

      const refreshed = this._vault.find((i) => i.id === id);
      if (refreshed) return refreshed;
    }

    throw new AmphoraError("Kryptos not found by id", {
      code: "kryptos_not_found_by_id",
      data: { id, totalKeys: this._vault.length },
      title: "Kryptos Not Found By ID",
      details: `No Kryptos with id "${id}" exists in the vault, even after refreshing external providers. Confirm the id is correct and the key is available.`,
    });
  }

  findByIdSync(id: string): IKryptos {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
        {
          code: this._setupPromise ? "setup_in_progress" : "setup_required_for_sync",
          data: { externalProviders: this._external.length },
          title: this._setupPromise ? "Setup In Progress" : "Setup Required For Sync",
          details: this._setupPromise
            ? "Amphora setup() is currently running; await setup() to finish before calling synchronous methods."
            : "External providers are configured, so setup() must complete before synchronous methods can be used. Call and await setup() first.",
        },
      );
    }

    const existing = this._vault.find((i) => i.id === id);
    if (existing) return existing;

    throw new AmphoraError("Kryptos not found by id", {
      code: "kryptos_not_found_by_id_sync",
      data: { id, totalKeys: this._vault.length },
      title: "Kryptos Not Found By ID (Sync)",
      details: `No Kryptos with id "${id}" exists in the vault. Synchronous lookup does not refresh external providers, so the key must already be loaded.`,
    });
  }

  findSync(predicate: AmphoraPredicate): IKryptos {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
        {
          code: this._setupPromise ? "setup_in_progress" : "setup_required_for_sync",
          data: { externalProviders: this._external.length },
          title: this._setupPromise ? "Setup In Progress" : "Setup Required For Sync",
          details: this._setupPromise
            ? "Amphora setup() is currently running; await setup() to finish before calling synchronous methods."
            : "External providers are configured, so setup() must complete before synchronous methods can be used. Call and await setup() first.",
        },
      );
    }

    const [key] = this.filterSync(predicate);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query (sync, no refresh)", {
      code: "kryptos_not_found_by_query_sync",
      data: {
        queryKeys: Object.keys(predicate),
        totalKeys: this._vault.length,
        activeKeys: this._vault.filter((i) => i.isActive).length,
      },
      title: "Kryptos Not Found By Query (Sync)",
      details: `No active Kryptos matched the query (${Object.keys(predicate).join(", ")}). Synchronous lookup does not refresh providers, so a matching key must already be loaded.`,
    });
  }

  async refresh(): Promise<void> {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = this._refresh();

    try {
      await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  private async _refresh(): Promise<void> {
    this.logger.silly("Refreshing vault");

    await this.refreshExternalConfig();
    await this.refreshExternalKeys();

    this._lastRefresh = new Date();
  }

  // The question is never "does key_ops list this operation?" but "does the vault
  // hold the HALF the operation needs?" — which is what `hasPrivateKey` answers.
  // Note `canEncrypt` asks for `use: "enc"` alone: an oct key has no public half
  // (its secret lives in the private one), so demanding `hasPublicKey` would
  // exclude every dir / A*KW / PBES2 key. `hasPrivateKey` on the decrypt side is
  // also exactly what excludes remotely-fetched keys — a JWKS only ever yields
  // public halves.

  canEncrypt(): boolean {
    return this.filteredKeys({ use: "enc" }).length > 0;
  }

  canDecrypt(): boolean {
    return this.filteredKeys({ use: "enc", hasPrivateKey: true }).length > 0;
  }

  canSign(): boolean {
    return this.filteredKeys({ use: "sig", hasPrivateKey: true }).length > 0;
  }

  canVerify(): boolean {
    return this.filteredKeys({ use: "sig" }).length > 0;
  }

  // private methods

  private async addExternalConfig(options: AmphoraExternalOption): Promise<void> {
    this.logger.silly("Adding external config", { options });

    if (isUrlLike(options.openIdConfigurationUri)) {
      const { data } = await this.conduit.get<OpenIdConfigurationResponse>(
        options.openIdConfigurationUri,
      );

      this._config.push({
        ...data,
        ...(options.openIdConfiguration ?? {}),
        ...(options.trustAnchors ? { trustAnchors: options.trustAnchors } : {}),
        ...(options.trustMode ? { trustMode: options.trustMode } : {}),
      });

      return;
    }

    if (isString(options.issuer) && isUrlLike(options.jwksUri)) {
      this._config.push({
        issuer: options.issuer,
        jwksUri: options.jwksUri,
        ...(options.openIdConfiguration ?? {}),
        ...(options.trustAnchors ? { trustAnchors: options.trustAnchors } : {}),
        ...(options.trustMode ? { trustMode: options.trustMode } : {}),
      });

      return;
    }

    throw new AmphoraError("Invalid external issuer options", {
      code: "invalid_issuer_options",
      data: {
        issuer: options.issuer,
        jwksUri: options.jwksUri,
        openIdConfigurationUri: options.openIdConfigurationUri,
      },
      title: "Invalid Issuer Options",
      // Public, non-secret config — server-only in debug for diagnosis.
      debug: {
        openIdConfiguration: options.openIdConfiguration,
        trustAnchors: options.trustAnchors,
      },
      details:
        "An external option must provide either a valid openIdConfigurationUri, or both a string issuer and a valid jwksUri.",
    });
  }

  // `publish: false` hides a key from SELECTION, not merely from publication: an
  // internal key (KEK, CA, cookie, session) must never be handed to a caller who
  // did not ask for one. That is what the default here does — every query starts
  // from the published set, so a consumer cannot accidentally sign with a key that
  // is absent from the JWKS and therefore unverifiable by anyone.
  //
  // The CALLER'S KEY WINS (spread order):
  //   {}                            -> published keys only (the safe default)
  //   { publish: false }            -> internal keys only (explicit opt-in)
  //   { publish: { $exists: true } } -> both
  private filteredKeys(predicate: AmphoraPredicate): Array<IKryptos> {
    const vault = this._vault.filter((i) => i.isActive);

    return Predicated.filter<IKryptos>(vault, { publish: true, ...predicate }).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  private async getExternalJwks(config: AmphoraConfig): Promise<Array<IKryptos>> {
    this.logger.silly("Finding External JWKS", { issuer: config.issuer });

    const {
      data: { keys },
    } = await this.conduit.get<OpenIdJwksResponse>(config.jwksUri);

    if (keys.length === 0) {
      this.logger.warn("External JWKS response contains no keys", {
        issuer: config.issuer,
      });
      return [];
    }

    if (keys.length > this.maxExternalKeys) {
      this.logger.warn("External JWKS response exceeds key limit, truncating", {
        issuer: config.issuer,
        count: keys.length,
        limit: this.maxExternalKeys,
      });
      keys.length = this.maxExternalKeys;
    }

    const result: Array<IKryptos> = [];
    let rejectedCount = 0;
    let expiredCount = 0;
    let rejectedByTrust = 0;
    let unusableCount = 0;

    const trustAnchors = config.trustAnchors;
    const trustRequired =
      (isString(trustAnchors) && trustAnchors.length > 0) ||
      (isArray(trustAnchors) && trustAnchors.length > 0);
    const trustMode = config.trustMode ?? "strict";

    for (const jwk of keys) {
      if (jwk.iss && jwk.iss !== config.issuer) {
        this.logger.warn("External JWK issuer mismatch, skipping key", {
          expected: config.issuer,
          actual: jwk.iss,
          kid: jwk.kid,
        });
        rejectedCount++;
        continue;
      }

      // One unusable key must not take out the issuer's entire key set. A JWK that
      // kryptos cannot parse (commonly a missing "alg", which RFC 7517 makes optional
      // but kryptos requires) is skipped like any other rejected key.
      let kryptos: IKryptos;

      try {
        kryptos = KryptosKit.from.jwk(
          {
            ...jwk,
            iss: config.issuer,
            jku: jwk.jku ?? config.jwksUri,
          },
          // Not ours — this key came off a remote JWKS. It is also `from.jwk`'s
          // default, but a provenance claim is worth stating outright.
          false,
        );
      } catch (error) {
        this.logger.warn("External JWK rejected: key could not be parsed", {
          issuer: config.issuer,
          kid: jwk.kid,
          error: error instanceof Error ? error.message : String(error),
        });
        unusableCount++;
        continue;
      }

      if (kryptos.isExpired) {
        expiredCount++;
        continue;
      }

      if (trustRequired) {
        if (!kryptos.hasCertificate) {
          if (trustMode === "strict") {
            this.logger.warn(
              "External JWK rejected: trust validation required but key has no certificate chain",
              { issuer: config.issuer, kid: jwk.kid },
            );
            rejectedByTrust++;
            continue;
          }

          this.logger.debug(
            "External JWK accepted without cert validation (lax trust mode)",
            { issuer: config.issuer, kid: jwk.kid },
          );
        } else {
          try {
            kryptos.verifyCertificate({ trustAnchors: trustAnchors });
          } catch (error) {
            this.logger.warn(
              "External JWK rejected: certificate chain failed trust validation",
              {
                issuer: config.issuer,
                kid: jwk.kid,
                error: error instanceof Error ? error.message : String(error),
              },
            );
            rejectedByTrust++;
            continue;
          }
        }
      }

      this.logger.silly("Adding Kryptos from external source", { kryptos });
      result.push(kryptos);
    }

    if (
      rejectedCount > 0 ||
      expiredCount > 0 ||
      rejectedByTrust > 0 ||
      unusableCount > 0
    ) {
      this.logger.silly("External JWKS key summary", {
        issuer: config.issuer,
        total: keys.length,
        valid: result.length,
        rejected: rejectedCount,
        expired: expiredCount,
        rejectedByTrust,
        unusable: unusableCount,
      });
    }

    if (result.length === 0 && keys.length > 0) {
      const data = {
        issuer: config.issuer,
        total: keys.length,
        rejected: rejectedCount,
        expired: expiredCount,
        rejectedByTrust,
        unusable: unusableCount,
      };

      if (rejectedByTrust === keys.length) {
        throw new AmphoraError(
          "All external JWK keys rejected due to trust anchor validation",
          {
            code: "external_jwks_all_rejected_by_trust",
            data,
            title: "External JWKS All Rejected By Trust",
            details: `Every key from issuer "${config.issuer}" failed trust anchor validation. Verify the configured trustAnchors and the keys' certificate chains.`,
          },
        );
      }

      if (rejectedCount === keys.length) {
        throw new AmphoraError("All external JWK keys rejected due to issuer mismatch", {
          code: "external_jwks_issuer_mismatch",
          data,
          title: "External JWKS Issuer Mismatch",
          details: `Every key returned for issuer "${config.issuer}" declared a different "iss" value. Ensure the configured issuer matches the keys served at the JWKS endpoint.`,
        });
      }

      if (unusableCount === keys.length) {
        throw new AmphoraError("All external JWK keys could not be parsed", {
          code: "external_jwks_all_unusable",
          data,
          title: "External JWKS All Unusable",
          details: `Every key returned for issuer "${config.issuer}" could not be parsed. The endpoint is serving keys this library cannot read — most commonly a JWK without an "alg" (optional in RFC 7517, required here). Inspect the JWKS document and ensure each key declares "alg" and "kid".`,
        });
      }

      if (
        expiredCount + rejectedCount + rejectedByTrust + unusableCount ===
        keys.length
      ) {
        throw new AmphoraError(
          "No valid external JWK keys (expired, rejected, untrusted, or unparseable)",
          {
            code: "external_jwks_no_valid_keys",
            data,
            title: "External JWKS No Valid Keys",
            details: `All keys from issuer "${config.issuer}" were unusable (expired, issuer-mismatched, untrusted, or unparseable). Check that the endpoint serves current, trusted, parseable keys for this issuer.`,
          },
        );
      }
    }

    return result;
  }

  private mapExternalOptions(): void {
    const result: Array<AmphoraExternalOption> = [];

    for (const item of this._external) {
      if (isUrlLike(item.openIdConfigurationUri)) {
        result.push({
          openIdConfiguration: item.openIdConfiguration,
          openIdConfigurationUri: item.openIdConfigurationUri,
          trustAnchors: item.trustAnchors,
          trustMode: item.trustMode,
        });
      } else if (isString(item.issuer) && isUrlLike(item.jwksUri)) {
        result.push({
          issuer: item.issuer,
          jwksUri: item.jwksUri,
          openIdConfiguration: item.openIdConfiguration,
          trustAnchors: item.trustAnchors,
          trustMode: item.trustMode,
        });
      } else if (isUrlLike(item.issuer)) {
        result.push({
          openIdConfiguration: item.openIdConfiguration,
          openIdConfigurationUri: new URL(OIDCONF, item.issuer).toString(),
          trustAnchors: item.trustAnchors,
          trustMode: item.trustMode,
        });
      } else {
        throw new AmphoraError("Invalid external option", {
          code: "invalid_external_options",
          title: "Invalid External Options",
          details:
            "An external option must provide a valid openIdConfigurationUri, a valid issuer URL, or both a string issuer and a valid jwksUri.",
          debug: { item },
        });
      }
    }

    this._external = result;
  }

  private async refreshExternalConfig(): Promise<void> {
    this.logger.silly("Loading external config");

    this._config = [];
    let failures = 0;

    for (const options of this._external) {
      try {
        await this.addExternalConfig(options);
      } catch (error) {
        failures++;
        this.logger.warn("Failed to load external config", {
          error,
          issuer: options.issuer ?? options.openIdConfigurationUri,
        });
      }
    }

    if (this._external.length > 0 && failures === this._external.length) {
      throw new AmphoraError("All external config providers failed during refresh", {
        code: "external_config_providers_failed",
        data: { failed: failures, total: this._external.length },
        title: "External Config Providers Failed",
        details: `All ${this._external.length} external configuration provider(s) failed to load during refresh. Check provider availability and the openIdConfigurationUri/jwksUri endpoints.`,
      });
    }
  }

  private async refreshExternalKeys(): Promise<void> {
    this.logger.silly("Refreshing external keys");

    const results = await Promise.allSettled(
      this._config.map(async (config) => {
        const keys = await this.getExternalJwks(config);
        return { config, keys };
      }),
    );

    let failures = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { config, keys } = result.value;
        // Swap out this issuer's previously-fetched keys for the fresh set — but
        // only the FOREIGN ones. An env-imported key of our own can legitimately
        // carry the same issuer as a configured provider, and must survive the swap.
        this._vault = this._vault
          .filter((i) => i.internal || i.issuer !== config.issuer)
          .concat(keys);
      } else {
        failures++;
        this.logger.warn("Failed to refresh external JWKS", {
          error: result.reason,
        });
      }
    }

    if (this._config.length > 0 && failures === this._config.length) {
      throw new AmphoraError("All external JWKS providers failed during refresh", {
        code: "external_jwks_providers_failed",
        data: { failed: failures, total: this._config.length },
        title: "External JWKS Providers Failed",
        details: `All ${this._config.length} external JWKS provider(s) failed to return usable keys during refresh. Check provider availability and the JWKS endpoints.`,
      });
    }
  }

  private refreshJwks(): void {
    if (this.domain === null) return;

    this.logger.silly("Refreshing JWKS");

    this._jwks = Predicated.filter(this._vault, {
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
}
