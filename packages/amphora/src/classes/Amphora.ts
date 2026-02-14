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

  private _config: Array<AmphoraConfig>;
  private _external: Array<AmphoraExternalOption>;
  private _jwks: Array<LindormJwk>;
  private _setup: boolean;
  private _vault: Array<IKryptos>;

  public constructor(options: AmphoraOptions) {
    this.logger = options.logger.child(["Amphora"]);

    this.conduit = new Conduit({
      alias: "Amphora",
      logger: this.logger,
      middleware: [conduitChangeResponseDataMiddleware()],
      retryOptions: { maxAttempts: 10 },
    });

    this._config = [];
    this._external = options.external ?? [];
    this._jwks = [];
    this._setup = false;
    this._vault = [];

    this.domain = options.domain ?? null;

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

    this.mapExternalOptions();

    await this.refresh();

    this._setup = true;
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
    const filtered = this.filteredKeys(query);

    if (filtered.length) return filtered;

    await this.refresh();

    return this.filteredKeys(query);
  }

  public filterSync(query: AmphoraQuery): Array<IKryptos> {
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

    const result: Array<IKryptos> = [];

    for (const jwk of keys) {
      const iss = jwk.iss ?? config.issuer;
      const jku = jwk.jku ?? config.jwksUri;

      const kryptos = KryptosKit.from.jwk({ ...jwk, iss, jku });

      if (kryptos.isExpired) continue;

      this.logger.silly("Adding Kryptos from external source", { kryptos });

      result.push(kryptos);
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

    for (const options of this._external) {
      await this.addExternalConfig(options);
    }
  }

  private async refreshExternalKeys(): Promise<void> {
    this.logger.silly("Refreshing external keys");

    for (const config of this._config) {
      const keys = await this.getExternalJwks(config);

      this._vault = this._vault.filter((i) => i.issuer !== config.issuer).concat(keys);
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
