import { addDays, getUnixTime, isAfter, isEqual } from "@lindorm/date";
import { isBuffer } from "@lindorm/is";
import { removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { KryptosError } from "../errors";
import {
  IKryptos,
  IKryptosEc,
  IKryptosOct,
  IKryptosOkp,
  IKryptosRsa,
} from "../interfaces";
import {
  AutoGenerateKryptos,
  GenerateEcKryptos,
  GenerateKryptos,
  GenerateOctKryptos,
  GenerateOkpKryptos,
  GenerateRsaKryptos,
  KryptosAlgorithm,
  KryptosAttributes,
  KryptosB64,
  KryptosCurve,
  KryptosDer,
  KryptosEncryption,
  KryptosExportMode,
  KryptosFormat,
  KryptosFrom,
  KryptosFromB64,
  KryptosFromDer,
  KryptosFromJwk,
  KryptosFromPem,
  KryptosJwk,
  KryptosKey,
  KryptosKeys,
  KryptosLike,
  KryptosMetadata,
  KryptosOperation,
  KryptosOptions,
  KryptosPem,
  KryptosType,
  KryptosUse,
  LindormJwk,
  RsaModulus,
} from "../types";
import { exportToB64 } from "../utils/private/export/export-b64";
import { exportToDer } from "../utils/private/export/export-der";
import { exportToJwk } from "../utils/private/export/export-jwk";
import { exportToPem } from "../utils/private/export/export-pem";
import { fromOptions } from "../utils/private/from";
import { createDerFromDer } from "../utils/private/from/der-from-der";
import { autoGenerateConfig, generateKey } from "../utils/private/generate";
import { isB64, isDer, isJwk, isPem } from "../utils/private/is";
import { calculateKeyOps } from "../utils/private/key-ops";
import { isOctDer } from "../utils/private/oct/is";
import { modulusSize } from "../utils/private/rsa/modulus-size";

export class Kryptos implements IKryptos {
  private readonly _id: string;
  private readonly _createdAt: Date;
  private readonly _curve: KryptosCurve | undefined;
  private readonly _isExternal: boolean;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer | undefined;
  private readonly _type: KryptosType;

  private _algorithm: KryptosAlgorithm;
  private _encryption: KryptosEncryption | undefined;
  private _expiresAt: Date;
  private _issuer: string | undefined;
  private _jwksUri: string | undefined;
  private _notBefore: Date;
  private _operations: Array<KryptosOperation>;
  private _ownerId: string | undefined;
  private _updatedAt: Date;
  private _use: KryptosUse;

  public constructor(options: KryptosOptions) {
    this._id = options.id || randomUUID();
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._curve = options.curve;
    this._encryption = options.encryption;
    this._expiresAt = options.expiresAt ?? addDays(new Date(), 180);
    this._isExternal = options.isExternal ?? false;
    this._issuer = options.issuer;
    this._jwksUri = options.jwksUri;
    this._notBefore = options.notBefore ?? new Date();
    this._operations = options.operations ?? [];
    this._ownerId = options.ownerId;
    this._type = options.type;
    this._updatedAt = options.updatedAt ?? new Date();
    this._use = options.use;

    if (options.privateKey && !options.publicKey) {
      const keys = this.generateKeys(options);

      this._privateKey = keys.privateKey;
      this._publicKey = keys.publicKey;
    } else {
      this._privateKey = options.privateKey;
      this._publicKey = options.publicKey;
    }

    if (!this._privateKey && !this._publicKey) {
      throw new KryptosError(
        "Kryptos must be initialised with private key, public key, or both",
      );
    }
  }

  // getters and setters

  public get id(): string {
    return this._id;
  }

  public get algorithm(): KryptosAlgorithm {
    return this._algorithm;
  }

  public set algorithm(algorithm: KryptosAlgorithm) {
    this._algorithm = algorithm;
    this._updatedAt = new Date();
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get curve(): KryptosCurve | undefined {
    return this._curve;
  }

  public get encryption(): KryptosEncryption | undefined {
    return this._encryption;
  }

  public set encryption(encryption: KryptosEncryption) {
    this._encryption = encryption;
    this._updatedAt = new Date();
  }

  public get expiresAt(): Date {
    return this._expiresAt;
  }

  public set expiresAt(date: Date) {
    this._expiresAt = date;
    this._updatedAt = new Date();
  }

  public get expiresIn(): number {
    return getUnixTime(this._expiresAt) - getUnixTime(new Date());
  }

  public get isActive(): boolean {
    return Boolean(this.isUsable && !this.isExpired);
  }

  public get isExpired(): boolean {
    if (!this._expiresAt) return false;
    return isEqual(new Date(), this._expiresAt) || isAfter(new Date(), this._expiresAt);
  }

  public get isExternal(): boolean {
    return this._isExternal;
  }

  public get isUsable(): boolean {
    return isEqual(new Date(), this._notBefore) || isAfter(new Date(), this._notBefore);
  }

  public get issuer(): string | undefined {
    return this._issuer;
  }

  public get jwksUri(): string | undefined {
    return this._jwksUri;
  }

  public set jwksUri(uri: string | undefined) {
    this._jwksUri = uri;
    this._updatedAt = new Date();
  }

  public get modulus(): RsaModulus | undefined {
    if (this._type !== "RSA") return undefined;
    return modulusSize({ privateKey: this._privateKey, publicKey: this._publicKey! });
  }

  public get notBefore(): Date {
    return this._notBefore;
  }

  public set notBefore(date: Date) {
    this._notBefore = date;
    this._updatedAt = new Date();
  }

  public get operations(): Array<KryptosOperation> {
    return this._operations;
  }

  public set operations(operations: Array<KryptosOperation>) {
    this._operations = operations;
    this._updatedAt = new Date();
  }

  public get ownerId(): string | undefined {
    return this._ownerId;
  }

  public set ownerId(ownerId: string | undefined) {
    this._ownerId = ownerId;
    this._updatedAt = new Date();
  }

  public get type(): KryptosType {
    return this._type;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get use(): KryptosUse {
    return this._use;
  }

  public set use(use: KryptosUse) {
    this._use = use;
    this._updatedAt = new Date();
  }

  // metadata

  public get hasPrivateKey(): boolean {
    return isBuffer(this._privateKey) && this._privateKey.length > 0;
  }

  public get hasPublicKey(): boolean {
    return isBuffer(this._publicKey) && this._publicKey.length > 0;
  }

  // to json

  public toJSON(): KryptosAttributes & KryptosMetadata {
    return removeUndefined<KryptosAttributes & KryptosMetadata>({
      id: this.id,
      algorithm: this.algorithm,
      createdAt: this.createdAt,
      curve: this.curve,
      encryption: this.encryption,
      expiresAt: this.expiresAt,
      expiresIn: this.expiresIn,
      hasPrivateKey: this.hasPrivateKey,
      hasPublicKey: this.hasPublicKey,
      isActive: this.isActive,
      isExpired: this.isExpired,
      isExternal: this.isExternal,
      issuer: this.issuer,
      isUsable: this.isUsable,
      jwksUri: this.jwksUri,
      modulus: this.modulus,
      notBefore: this.notBefore,
      operations: this.operations,
      ownerId: this.ownerId,
      type: this.type,
      updatedAt: this.updatedAt,
      use: this.use,
    });
  }

  // public methods

  public clone(): Kryptos {
    return new Kryptos({
      ...this.toJSON(),
      privateKey: this._privateKey,
      publicKey: this._publicKey,
    });
  }

  public export<K extends KryptosB64>(format: "b64"): K;
  public export<K extends KryptosDer>(format: "der"): K;
  public export<K extends KryptosJwk>(format: "jwk"): K;
  public export<K extends KryptosPem>(format: "pem"): K;
  public export(format: KryptosFormat): KryptosKey {
    switch (format) {
      case "b64":
        return exportToB64({
          algorithm: this.algorithm,
          curve: this.curve,
          privateKey: this._privateKey,
          publicKey: this._publicKey,
          type: this.type,
          use: this.use,
        });

      case "der":
        return exportToDer({
          algorithm: this.algorithm,
          curve: this.curve,
          privateKey: this._privateKey,
          publicKey: this._publicKey,
          type: this.type,
          use: this.use,
        });

      case "jwk":
        return exportToJwk({
          algorithm: this.algorithm,
          curve: this.curve,
          mode: "private",
          privateKey: this._privateKey,
          publicKey: this._publicKey,
          type: this.type,
          use: this.use,
        });

      case "pem":
        return exportToPem({
          algorithm: this.algorithm,
          curve: this.curve,
          privateKey: this._privateKey,
          publicKey: this._publicKey,
          type: this.type,
          use: this.use,
        });

      default:
        throw new KryptosError(`Invalid key format: ${format}`);
    }
  }

  public toJWK(mode: KryptosExportMode = "public"): LindormJwk {
    const keys = exportToJwk({
      algorithm: this.algorithm,
      curve: this.curve,
      mode: mode,
      privateKey: this._privateKey,
      publicKey: this._publicKey,
      type: this.type,
      use: this.use,
    });

    return removeUndefined({
      enc: this.encryption,
      exp: this.expiresAt ? getUnixTime(this.expiresAt) : undefined,
      iat: getUnixTime(this.createdAt),
      iss: this.issuer,
      jku: this.jwksUri ?? undefined,
      key_ops: this.operations,
      kid: this.id,
      nbf: getUnixTime(this.notBefore),
      owner_id: this.ownerId ?? undefined,
      uat: getUnixTime(this.updatedAt),
      ...keys,
    });
  }

  // public static

  public static auto(options: AutoGenerateKryptos): IKryptos {
    const config = autoGenerateConfig(options.algorithm);

    config.encryption = options.encryption ? options.encryption : config.encryption;

    return new Kryptos({
      operations: calculateKeyOps(config.use),
      ...options,
      ...config,
      ...generateKey(config),
    });
  }

  public static generate(options: GenerateEcKryptos): IKryptosEc;
  public static generate(options: GenerateOctKryptos): IKryptosOct;
  public static generate(options: GenerateOkpKryptos): IKryptosOkp;
  public static generate(options: GenerateRsaKryptos): IKryptosRsa;
  public static generate(options: GenerateKryptos): IKryptos {
    return new Kryptos({
      operations: calculateKeyOps(options.use),
      ...options,
      ...generateKey(options),
    });
  }

  public static from(format: "b64", b64: KryptosFromB64): Kryptos;
  public static from(format: "der", der: KryptosFromDer): Kryptos;
  public static from(format: "jwk", jwk: KryptosFromJwk): Kryptos;
  public static from(format: "pem", pem: KryptosFromPem): Kryptos;
  public static from(format: KryptosFormat, arg: KryptosFrom): Kryptos {
    const options = fromOptions(format, arg);

    if (!options.algorithm) {
      throw new KryptosError("Algorithm is required");
    }
    if (!options.type) {
      throw new KryptosError("Type is required");
    }
    if (!options.use) {
      throw new KryptosError("Use is required");
    }

    return new Kryptos(options);
  }

  public static make(options: KryptosFrom): Kryptos {
    if (isB64(options)) return Kryptos.from("b64", options);
    if (isDer(options)) return Kryptos.from("der", options);
    if (isJwk(options)) return Kryptos.from("jwk", options);
    if (isPem(options)) return Kryptos.from("pem", options);

    throw new KryptosError("Invalid key format");
  }

  public static isEc(kryptos: KryptosLike): kryptos is IKryptosEc {
    return (
      kryptos instanceof Kryptos && kryptos.type === "EC" && kryptos.curve !== undefined
    );
  }

  public static isOct(kryptos: KryptosLike): kryptos is IKryptosOct {
    return (
      kryptos instanceof Kryptos && kryptos.type === "oct" && kryptos.curve === undefined
    );
  }

  public static isOkp(kryptos: KryptosLike): kryptos is IKryptosOkp {
    return (
      kryptos instanceof Kryptos && kryptos.type === "OKP" && kryptos.curve !== undefined
    );
  }

  public static isRsa(kryptos: KryptosLike): kryptos is IKryptosRsa {
    return (
      kryptos instanceof Kryptos && kryptos.type === "RSA" && kryptos.curve === undefined
    );
  }

  // private methods

  private generateKeys(options: KryptosOptions): KryptosKeys {
    const keys = createDerFromDer(options as KryptosDer);

    if (isOctDer(keys)) {
      return { privateKey: keys.privateKey };
    } else {
      return { privateKey: keys.privateKey, publicKey: keys.publicKey };
    }
  }
}
