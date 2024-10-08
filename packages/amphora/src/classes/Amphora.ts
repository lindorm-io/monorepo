import { Conduit, conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { isArray, isBoolean, isString, isUrlLike } from "@lindorm/is";
import { IKryptos, Kryptos, LindormJwk } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { OpenIdConfigurationResponse, OpenIdJwksResponse } from "@lindorm/types";
import { AmphoraError } from "../errors";
import { IAmphora } from "../interfaces";
import {
  AmphoraConfig,
  AmphoraExternalOption,
  AmphoraJwks,
  AmphoraOptions,
  AmphoraQuery,
} from "../types";

export class Amphora implements IAmphora {
  private readonly conduit: Conduit;
  private readonly external: Array<AmphoraExternalOption>;
  private readonly issuer: string | null;
  private readonly logger: ILogger;

  private readonly _config: Array<AmphoraConfig>;
  private _jwks: Array<LindormJwk>;
  private _setup: boolean;
  private _vault: Array<IKryptos>;

  public constructor(options: AmphoraOptions) {
    this.logger = options.logger.child(["Amphora"]);

    this.conduit = new Conduit({
      alias: "Amphora",
      logger: this.logger,
      middleware: [conduitChangeResponseDataMiddleware()],
      retryOptions: {
        maxAttempts: 10,
      },
    });

    this._config = [];
    this.external = options.external ?? [];
    this.issuer = options.issuer ?? null;
    this._jwks = [];
    this._setup = false;
    this._vault = [];
  }

  // public getters

  public get config(): Array<AmphoraConfig> {
    return this._config;
  }

  public get jwks(): AmphoraJwks {
    if (!this.issuer) {
      throw new AmphoraError("Issuer is required to get JWKS");
    }

    return { keys: this._jwks };
  }

  public get vault(): Array<IKryptos> {
    return this._vault;
  }

  // public methods

  public add(kryptos: Array<IKryptos> | IKryptos): void {
    const array = isArray(kryptos) ? kryptos : [kryptos];

    for (const item of array) {
      if (!item.id) {
        throw new AmphoraError("Id is required when adding Kryptos");
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

  public async filter(query: AmphoraQuery): Promise<Array<IKryptos>> {
    const filtered = this.filteredKeys(query);
    if (filtered.length) return filtered;

    if (!query.issuer) {
      throw new AmphoraError("Unable to find Kryptos without issuer");
    }

    const config = await this.issuerConfig(query.issuer);
    await this.refreshExternal(config);

    return this.filteredKeys(query);
  }

  public async find(query: AmphoraQuery): Promise<IKryptos> {
    const [key] = await this.filter(query);
    if (key) return key;

    throw new AmphoraError("Kryptos not found using query");
  }

  public async refresh(): Promise<void> {
    this.logger.silly("Refreshing vault");

    for (const config of this._config) {
      await this.refreshExternal(config);
    }
  }

  public async setup(): Promise<void> {
    if (this._setup) return;

    await this.loadExternalConfig();
    await this.refresh();

    this._setup = true;
  }

  // private methods

  private async addExternalConfig(options: AmphoraExternalOption): Promise<void> {
    this.logger.silly("Adding external config", { options });

    if (isString(options.issuer) && isUrlLike(options.jwksUri)) {
      this._config.push({ issuer: options.issuer, jwksUri: options.jwksUri });
      return;
    }

    if (!isUrlLike(options.openIdConfigurationUri)) {
      throw new AmphoraError("Invalid issuer options");
    }

    const { data } = await this.conduit.get<OpenIdConfigurationResponse>(
      options.openIdConfigurationUri,
    );

    this._config.push({ issuer: data.issuer, jwksUri: data.jwksUri });
  }

  private filteredKeys(query: AmphoraQuery): Array<IKryptos> {
    return this._vault
      .filter((i) => i.isActive)
      .filter((i) => (isString(query.issuer) ? query.issuer === i.issuer : true))
      .filter((i) => (isString(query.id) ? i.id === query.id : true))
      .filter((i) => (isString(query.algorithm) ? i.algorithm === query.algorithm : true))
      .filter((i) => (isBoolean(query.external) ? i.isExternal === query.external : true))
      .filter((i) =>
        isString(query.operation) && i.operations.length
          ? i.operations.includes(query.operation)
          : true,
      )
      .filter((i) => (isString(query.ownerId) ? i.ownerId === query.ownerId : true))
      .filter((i) => (isBoolean(query.private) ? i.hasPrivateKey : true))
      .filter((i) => (isBoolean(query.public) ? i.hasPublicKey : true))
      .filter((i) => (isString(query.type) ? i.type === query.type : true))
      .filter((i) => (isString(query.use) ? i.use === query.use : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private async getExternalJwks(issuer: string): Promise<Array<IKryptos>> {
    this.logger.silly("Finding External JWKS", { issuer });

    const config = await this.issuerConfig(issuer);

    const {
      data: { keys },
    } = await this.conduit.get<OpenIdJwksResponse>(config.jwksUri);

    const result: Array<IKryptos> = [];

    for (const jwk of keys) {
      const iss = jwk.iss ?? config.issuer;
      const jku = jwk.jku ?? config.jwksUri;

      const kryptos = Kryptos.make({ ...jwk, iss, jku });

      if (kryptos.isExpired) continue;

      this.logger.silly("Adding Kryptos from external source", { kryptos });

      result.push(kryptos);
    }

    return result;
  }

  private async issuerConfig(issuer: string): Promise<AmphoraConfig> {
    if (this.external.length && !this._config.length) {
      await this.loadExternalConfig();
    }

    const config = this._config.find((c) => c.issuer === issuer);

    if (!config) {
      throw new AmphoraError("Issuer not found in config");
    }

    return config;
  }

  private async loadExternalConfig(): Promise<void> {
    this.logger.silly("Loading external config");

    for (const options of this.external) {
      await this.addExternalConfig(options);
    }
  }

  private async refreshExternal(config: AmphoraConfig): Promise<void> {
    const keys = await this.getExternalJwks(config.issuer);

    this._vault = this._vault.filter((i) => i.issuer !== config.issuer).concat(keys);
  }

  private refreshJwks(): void {
    if (this.issuer === null) return;

    this.logger.silly("Refreshing JWKS");

    this._jwks = this._vault
      .filter((i) => i.isActive)
      .filter((i) => !i.isExternal)
      .filter((i) => !i.ownerId)
      .filter((i) => i.hasPublicKey)
      .filter((i) => i.issuer === this.issuer)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((i) => i.toJWK("public"));
  }
}
