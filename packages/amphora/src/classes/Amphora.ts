import { Conduit, conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { isArray, isString, isUrlLike } from "@lindorm/is";
import { IKryptos, KryptosKit, LindormJwk } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { OpenIdConfigurationResponse, OpenIdJwksResponse } from "@lindorm/types";
import { Predicated } from "@lindorm/utils";
import { AmphoraError } from "../errors";
import { IAmphora } from "../interfaces";
import {
  AmphoraConfig,
  AmphoraExternalOption,
  AmphoraJwks,
  AmphoraOptions,
  AmphoraPredicate,
} from "../types";

const OIDCONF = "/.well-known/openid-configuration" as const;

export class Amphora implements IAmphora {
  public readonly domain: string | null;

  private readonly conduit: Conduit;
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

  public constructor(options: AmphoraOptions) {
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
    this.maxExternalKeys = options.maxExternalKeys ?? 100;
    this.refreshInterval = options.refreshInterval ?? 300_000;

    if (this.domain && !isUrlLike(this.domain)) {
      throw new AmphoraError("Domain must be a valid URL", {
        debug: { domain: this.domain },
      });
    }
  }

  // public getters

  public get config(): Array<AmphoraConfig> {
    return [...this._config];
  }

  public get jwks(): AmphoraJwks {
    if (!this.domain) {
      throw new AmphoraError("Domain is required to get JWKS", {
        details:
          "Domain is used to determine the signing issuer of the keys. If your server signs tokens, it must have a domain.",
      });
    }

    return { keys: [...this._jwks] };
  }

  public get vault(): Array<IKryptos> {
    return [...this._vault];
  }

  // private getters

  private get isStale(): boolean {
    if (!this._lastRefresh) return true;
    return Date.now() - this._lastRefresh.getTime() > this.refreshInterval;
  }

  // public setup

  public async setup(): Promise<void> {
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

  public add(kryptos: Array<IKryptos> | IKryptos): void {
    const array = isArray(kryptos) ? kryptos : [kryptos];

    for (const input of array) {
      if (!input.id) {
        throw new AmphoraError("Id is required when adding Kryptos");
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
        throw new AmphoraError("Issuer is required when adding Kryptos");
      }

      if (item.isExpired) {
        throw new AmphoraError("Kryptos is expired");
      }

      this._vault = this._vault.filter((i) => i.id !== item.id).concat(item);
    }

    this.refreshJwks();
  }

  public env(keys: Array<string> | string): void {
    const array = isArray(keys) ? keys : [keys];

    const result: Array<IKryptos> = [];

    for (const key of array) {
      result.push(KryptosKit.env.import(key));
    }

    this.add(result);
  }

  public async filter(predicate: AmphoraPredicate): Promise<Array<IKryptos>> {
    if (!this._setup && this._external.length) {
      await this.setup();
    }

    const filtered = this.filteredKeys(predicate);

    if (filtered.length && !this.isStale) return filtered;

    await this.refresh();

    return this.filteredKeys(predicate);
  }

  public filterSync(predicate: AmphoraPredicate): Array<IKryptos> {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
      );
    }

    return this.filteredKeys(predicate);
  }

  public async find(predicate: AmphoraPredicate): Promise<IKryptos> {
    const [key] = await this.filter(predicate);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query after refresh", {
      debug: {
        queryKeys: Object.keys(predicate),
        totalKeys: this._vault.length,
        activeKeys: this._vault.filter((i) => i.isActive).length,
      },
    });
  }

  public async findById(id: string): Promise<IKryptos> {
    const existing = this._vault.find((i) => i.id === id);
    if (existing) return existing;

    if (this._external.length) {
      await this.refresh();

      const refreshed = this._vault.find((i) => i.id === id);
      if (refreshed) return refreshed;
    }

    throw new AmphoraError("Kryptos not found by id", {
      debug: { id, totalKeys: this._vault.length },
    });
  }

  public findByIdSync(id: string): IKryptos {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
      );
    }

    const existing = this._vault.find((i) => i.id === id);
    if (existing) return existing;

    throw new AmphoraError("Kryptos not found by id", {
      debug: { id, totalKeys: this._vault.length },
    });
  }

  public findSync(predicate: AmphoraPredicate): IKryptos {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
      );
    }

    const [key] = this.filterSync(predicate);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query (sync, no refresh)", {
      debug: {
        queryKeys: Object.keys(predicate),
        totalKeys: this._vault.length,
        activeKeys: this._vault.filter((i) => i.isActive).length,
      },
    });
  }

  public async refresh(): Promise<void> {
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

  public canEncrypt(): boolean {
    return (
      this.filteredKeys({
        $or: [
          { operations: { $in: ["encrypt", "deriveKey", "wrapKey"] } },
          { use: "enc" },
        ],
      }).length > 0
    );
  }

  public canDecrypt(): boolean {
    return (
      this.filteredKeys({
        $or: [
          { operations: { $in: ["decrypt", "deriveKey", "unwrapKey"] } },
          { use: "enc" },
        ],
      }).length > 0
    );
  }

  public canSign(): boolean {
    return (
      this.filteredKeys({ $or: [{ operations: ["sign"] }, { use: "sig" }] }).length > 0
    );
  }

  public canVerify(): boolean {
    return (
      this.filteredKeys({ $or: [{ operations: ["verify"] }, { use: "sig" }] }).length > 0
    );
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

    throw new AmphoraError("Invalid issuer options");
  }

  private filteredKeys(predicate: AmphoraPredicate): Array<IKryptos> {
    const vault = this._vault.filter((i) => i.isActive);

    return Predicated.filter<IKryptos>(vault, predicate).sort(
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

      const kryptos = KryptosKit.from.jwk({
        ...jwk,
        iss: config.issuer,
        jku: jwk.jku ?? config.jwksUri,
      });

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

          this.logger.silly(
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

    if (rejectedCount > 0 || expiredCount > 0 || rejectedByTrust > 0) {
      this.logger.silly("External JWKS key summary", {
        issuer: config.issuer,
        total: keys.length,
        valid: result.length,
        rejected: rejectedCount,
        expired: expiredCount,
        rejectedByTrust,
      });
    }

    if (result.length === 0 && keys.length > 0) {
      const debug = {
        issuer: config.issuer,
        total: keys.length,
        rejected: rejectedCount,
        expired: expiredCount,
        rejectedByTrust,
      };

      if (rejectedByTrust === keys.length) {
        throw new AmphoraError(
          "All external JWK keys rejected due to trust anchor validation",
          { debug },
        );
      }

      if (rejectedCount === keys.length) {
        throw new AmphoraError("All external JWK keys rejected due to issuer mismatch", {
          debug,
        });
      }

      if (expiredCount + rejectedCount + rejectedByTrust === keys.length) {
        throw new AmphoraError(
          "No valid external JWK keys (expired, rejected, or untrusted)",
          { debug },
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
        throw new AmphoraError("Invalid external options", { debug: { item } });
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
        this.logger.error("Failed to load external config", {
          error,
          issuer: options.issuer ?? options.openIdConfigurationUri,
        });
      }
    }

    if (this._external.length > 0 && failures === this._external.length) {
      throw new AmphoraError("All external config providers failed during refresh");
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
        this._vault = this._vault
          .filter((i) => !(i.issuer === config.issuer && i.isExternal))
          .concat(keys);
      } else {
        failures++;
        this.logger.error("Failed to refresh external JWKS", {
          error: result.reason,
        });
      }
    }

    if (this._config.length > 0 && failures === this._config.length) {
      throw new AmphoraError("All external JWKS providers failed during refresh");
    }
  }

  private refreshJwks(): void {
    if (this.domain === null) return;

    this.logger.silly("Refreshing JWKS");

    this._jwks = Predicated.filter(this._vault, {
      hasPublicKey: true,
      hidden: false,
      isExpired: false,
      isExternal: false,
      issuer: this.domain,
    })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((i) => i.toJWK("public"));
  }
}
