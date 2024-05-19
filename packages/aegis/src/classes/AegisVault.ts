import { Conduit, conduitChangeResponseDataMiddleware } from "@lindorm/conduit";
import { isArray, isBoolean, isString, isUrlLike } from "@lindorm/is";
import { IKryptos, Kryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { AegisVaultError } from "../errors";
import {
  AegisVaultOptions,
  AegisVaultQuery,
  IAegisVault,
  OpenIdConfigurationResponse,
  OpenIdJwksResponse,
  VaultConfig,
  VaultExternalOption,
} from "../types";

export class AegisVault implements IAegisVault {
  private readonly _conduit: Conduit;
  private readonly _config: Array<VaultConfig>;
  private readonly _external: Array<VaultExternalOption>;
  private readonly _logger: ILogger;

  private _vault: Array<IKryptos>;

  public constructor(options: AegisVaultOptions) {
    this._logger = options.logger.child(["AegisVault"]);

    this._conduit = new Conduit({
      alias: "AegisVault",
      logger: this._logger,
      middleware: [conduitChangeResponseDataMiddleware()],
      retryOptions: {
        maxAttempts: 10,
      },
    });

    this._external = options.external ?? [];
    this._config = [];
    this._vault = [];
  }

  // public getters

  public get config(): Array<VaultConfig> {
    return this._config;
  }

  public get vault(): Array<IKryptos> {
    return this._vault;
  }

  // public methods

  public async setup(): Promise<void> {
    await this.loadExternalConfig();
    await this.refresh();
  }

  public async refresh(): Promise<void> {
    this._logger.verbose("Refreshing vault");

    for (const config of this._config) {
      await this.refreshExternal(config);
    }
  }

  public add(kryptos: Array<IKryptos> | IKryptos): void {
    const array = isArray(kryptos) ? kryptos : [kryptos];

    for (const item of array) {
      if (!item.id) {
        throw new AegisVaultError("Id is required when adding Kryptos");
      }

      if (!item.issuer) {
        throw new AegisVaultError("Issuer is required when adding Kryptos");
      }

      if (item.isExpired) {
        throw new AegisVaultError("Kryptos is expired");
      }

      this._vault = this._vault.filter((i) => i.id !== item.id).concat(item);
    }
  }

  public async find(query: AegisVaultQuery): Promise<IKryptos> {
    const [key] = await this.filter(query);
    if (key) return key;

    throw new AegisVaultError("Kryptos not found using query");
  }

  public async filter(query: AegisVaultQuery): Promise<Array<IKryptos>> {
    const filtered = this.filteredKeys(query);
    if (filtered.length) return filtered;

    if (!query.issuer) {
      throw new AegisVaultError("Unable to find Kryptos without issuer");
    }

    const config = await this.issuerConfig(query.issuer);
    await this.refreshExternal(config);

    return this.filteredKeys(query);
  }

  // private methods

  private async addExternalConfig(options: VaultExternalOption): Promise<void> {
    if (isUrlLike(options.issuer) && isUrlLike(options.jwksUri)) {
      this._config.push({ issuer: options.issuer, jwksUri: options.jwksUri });
      return;
    }

    if (!isUrlLike(options.openIdConfigurationUri)) {
      throw new AegisVaultError("Invalid issuer options");
    }

    const {
      data: { issuer, jwksUri },
    } = await this._conduit.get<OpenIdConfigurationResponse>(
      options.openIdConfigurationUri,
    );

    this._config.push({ issuer, jwksUri });
  }

  private filteredKeys(query: AegisVaultQuery): Array<IKryptos> {
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

  private async getJwks(issuer: string): Promise<Array<IKryptos>> {
    this._logger.verbose("Finding JWKS", { issuer });

    const config = await this.issuerConfig(issuer);

    const {
      data: { keys },
    } = await this._conduit.get<OpenIdJwksResponse>(config.jwksUri);

    const result: Array<IKryptos> = [];

    for (const jwk of keys) {
      const iss = jwk.iss ?? config.issuer;
      const jku = jwk.jku ?? config.jwksUri;

      const kryptos = Kryptos.make({ ...jwk, iss, jku });

      if (kryptos.isExpired) continue;

      result.push(kryptos);
    }

    return result;
  }

  private async issuerConfig(issuer: string): Promise<VaultConfig> {
    if (this._external.length && !this._config.length) {
      await this.loadExternalConfig();
    }

    const config = this._config.find((c) => c.issuer === issuer);

    if (!config) {
      throw new AegisVaultError("Issuer not found in config");
    }

    return config;
  }

  private async loadExternalConfig(): Promise<void> {
    this._logger.verbose("Loading external config");

    for (const options of this._external) {
      await this.addExternalConfig(options);
    }
  }

  private async refreshExternal(config: VaultConfig): Promise<void> {
    const keys = await this.getJwks(config.issuer);

    this._vault = this._vault.filter((i) => i.issuer !== config.issuer).concat(keys);
  }
}
