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
  AmphoraQuery,
} from "../types";

const OIDCONF = "/.well-known/openid-configuration" as const;

export class Amphora implements IAmphora {
  public readonly domain: string | null;

  private readonly conduit: Conduit;
  private readonly logger: ILogger;
  private readonly maxExternalKeys: number;

  private _config: Array<AmphoraConfig>;
  private _external: Array<AmphoraExternalOption>;
  private _jwks: Array<LindormJwk>;
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

    if (this.domain && !isUrlLike(this.domain)) {
      throw new AmphoraError("Domain must be a valid URL", {
        debug: { domain: this.domain },
      });
    }
  }

  // public getters

  public get config(): Array<AmphoraConfig> {
    return this._config;
  }

  public get jwks(): AmphoraJwks {
    if (!this.domain) {
      throw new AmphoraError("Domain is required to get JWKS", {
        details:
          "Domain is used to determine the signing issuer of the keys. If your server signs tokens, it must have a domain.",
      });
    }

    return { keys: this._jwks };
  }

  public get vault(): Array<IKryptos> {
    return this._vault;
  }

  // public setup

  public async setup(): Promise<void> {
    if (this._setup) return;
    if (this._setupPromise) return this._setupPromise;

    this._setupPromise = (async () => {
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

    for (const item of array) {
      if (!item.id) {
        throw new AmphoraError("Id is required when adding Kryptos");
      }

      if (!item.issuer && this.domain) {
        this.logger.silly("Setting issuer on Kryptos from domain", {
          id: item.id,
          issuer: this.domain,
        });
        item.issuer = this.domain;
      }

      if (!item.jwksUri && this.domain) {
        const jwksUri = new URL("/.well-known/jwks.json", this.domain).toString();
        this.logger.silly("Setting jwksUri on Kryptos from domain", {
          id: item.id,
          jwksUri,
        });
        item.jwksUri = jwksUri;
      }

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

  public async filter(query: AmphoraQuery): Promise<Array<IKryptos>> {
    if (!this._setup && this._external.length) {
      await this.setup();
    }

    const filtered = this.filteredKeys(query);

    if (filtered.length) return filtered;

    await this.refresh();

    return this.filteredKeys(query);
  }

  public filterSync(query: AmphoraQuery): Array<IKryptos> {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
      );
    }

    return this.filteredKeys(query);
  }

  public async find(query: AmphoraQuery): Promise<IKryptos> {
    const [key] = await this.filter(query);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query after refresh", {
      debug: {
        queryKeys: Object.keys(query),
        totalKeys: this._vault.length,
        activeKeys: this._vault.filter((i) => i.isActive).length,
      },
    });
  }

  public findSync(query: AmphoraQuery): IKryptos {
    if (!this._setup && this._external.length) {
      throw new AmphoraError(
        this._setupPromise
          ? "setup() is in progress; await setup() before using sync methods"
          : "setup() must be called before using sync methods with external providers",
      );
    }

    const [key] = this.filterSync(query);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query (sync, no refresh)", {
      debug: {
        queryKeys: Object.keys(query),
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

      this._config.push({ ...data, ...(options.openIdConfiguration ?? {}) });

      return;
    }

    if (isString(options.issuer) && isUrlLike(options.jwksUri)) {
      this._config.push({
        issuer: options.issuer,
        jwksUri: options.jwksUri,
        ...(options.openIdConfiguration ?? {}),
      });

      return;
    }

    throw new AmphoraError("Invalid issuer options");
  }

  private filteredKeys(query: AmphoraQuery): Array<IKryptos> {
    const vault = this._vault.filter((i) => i.isActive);

    return Predicated.filter<IKryptos>(vault, query).sort(
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

      this.logger.silly("Adding Kryptos from external source", { kryptos });
      result.push(kryptos);
    }

    if (rejectedCount > 0 || expiredCount > 0) {
      this.logger.silly("External JWKS key summary", {
        issuer: config.issuer,
        total: keys.length,
        valid: result.length,
        rejected: rejectedCount,
        expired: expiredCount,
      });
    }

    if (result.length === 0 && keys.length > 0) {
      if (rejectedCount === keys.length) {
        throw new AmphoraError("All external JWK keys rejected due to issuer mismatch", {
          debug: { issuer: config.issuer, keyCount: keys.length },
        });
      } else if (expiredCount + rejectedCount === keys.length) {
        throw new AmphoraError("No valid external JWK keys (expired or rejected)", {
          debug: {
            issuer: config.issuer,
            total: keys.length,
            rejected: rejectedCount,
            expired: expiredCount,
          },
        });
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
        });
      } else if (isString(item.issuer) && isUrlLike(item.jwksUri)) {
        result.push({
          issuer: item.issuer,
          jwksUri: item.jwksUri,
          openIdConfiguration: item.openIdConfiguration,
        });
      } else if (isUrlLike(item.issuer)) {
        result.push({
          openIdConfiguration: item.openIdConfiguration,
          openIdConfigurationUri: new URL(OIDCONF, item.issuer).toString(),
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
      isActive: true,
      isExternal: false,
      issuer: this.domain,
    })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((i) => i.toJWK("public"));
  }
}
