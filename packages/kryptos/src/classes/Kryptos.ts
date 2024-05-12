import { B64 } from "@lindorm/b64";
import { getUnixTime, isAfter, isEqual } from "@lindorm/date";
import { isBuffer } from "@lindorm/is";
import { randomUUID } from "crypto";
import { KryptosError } from "../errors";
import {
  EcKryptos,
  FormatOptions,
  GenerateEcOptions,
  GenerateOctOptions,
  GenerateOkpOptions,
  GenerateOptions,
  GenerateResult,
  GenerateRsaOptions,
  KryptosAlgorithm,
  KryptosAttributes,
  KryptosB64,
  KryptosClone,
  KryptosCurve,
  KryptosDer,
  KryptosExportMode,
  KryptosFormat,
  KryptosFrom,
  KryptosFromB64,
  KryptosFromDer,
  KryptosFromJwk,
  KryptosFromPem,
  KryptosFromRaw,
  KryptosJwk,
  KryptosOperation,
  KryptosOptions,
  KryptosPem,
  KryptosRaw,
  KryptosType,
  KryptosUse,
  LindormJwk,
  OctKryptos,
  OkpKryptos,
  RsaKryptos,
} from "../types";
import {
  _exportEcToJwk,
  _exportEcToPem,
  _exportEcToRaw,
  _generateEcKey,
} from "../utils/private/ec";
import {
  _fromB64,
  _fromDer,
  _fromJwk,
  _fromJwkOptions,
  _fromPem,
  _fromRaw,
  _fromStdOptions,
} from "../utils/private/from";
import { _isB64, _isDer, _isJwk, _isPem, _isRaw } from "../utils/private/is";
import { _exportOctToJwk, _exportOctToPem, _generateOctKey } from "../utils/private/oct";
import { _exportOkpToJwk, _exportOkpToPem, _generateOkpKey } from "../utils/private/okp";
import { _exportRsaToJwk, _exportRsaToPem, _generateRsaKey } from "../utils/private/rsa";

export class Kryptos implements KryptosAttributes {
  private readonly _id: string;
  private readonly _createdAt: Date;
  private readonly _curve: KryptosCurve | undefined;
  private readonly _isExternal: boolean;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer | undefined;
  private readonly _type: KryptosType;

  private _algorithm: KryptosAlgorithm | undefined;
  private _expiresAt: Date | undefined;
  private _issuer: string | undefined;
  private _jwksUri: string | undefined;
  private _notBefore: Date;
  private _operations: Array<KryptosOperation>;
  private _ownerId: string | undefined;
  private _updatedAt: Date;
  private _use: KryptosUse | undefined;

  public constructor(options: KryptosOptions) {
    this._id = options.id || randomUUID();
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._curve = options.curve ?? undefined;
    this._expiresAt = options.expiresAt ?? undefined;
    this._isExternal = options.isExternal ?? false;
    this._issuer = options.issuer ?? undefined;
    this._jwksUri = options.jwksUri ?? undefined;
    this._notBefore = options.notBefore ?? new Date();
    this._operations = options.operations ?? [];
    this._ownerId = options.ownerId ?? undefined;
    this._privateKey = options.privateKey ?? undefined;
    this._publicKey = options.publicKey ?? undefined;
    this._type = options.type;
    this._updatedAt = options.updatedAt ?? new Date();
    this._use = options.use;
  }

  // Getters and Setters

  public get id(): string {
    return this._id;
  }

  public get algorithm(): KryptosAlgorithm | undefined {
    return this._algorithm;
  }

  public set algorithm(algorithm: KryptosAlgorithm | undefined) {
    this._algorithm = algorithm;
    this._updatedAt = new Date();
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get curve(): KryptosCurve | undefined {
    return this._curve;
  }

  public get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  public set expiresAt(date: Date | undefined) {
    this._expiresAt = date;
    this._updatedAt = new Date();
  }

  public get expiresIn(): number | undefined {
    if (!this._expiresAt) return undefined;
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

  public get use(): KryptosUse | undefined {
    return this._use;
  }

  public set use(use: KryptosUse) {
    this._use = use;
    this._updatedAt = new Date();
  }

  // metadata

  public get hasPrivateKey(): boolean {
    return isBuffer(this._privateKey);
  }

  public get hasPublicKey(): boolean {
    return isBuffer(this._publicKey);
  }

  // to json

  public toJSON(): KryptosAttributes {
    return {
      id: this.id,
      algorithm: this.algorithm,
      createdAt: this.createdAt,
      curve: this.curve,
      expiresAt: this.expiresAt,
      expiresIn: this.expiresIn,
      isActive: this.isActive,
      isExpired: this.isExpired,
      isExternal: this.isExternal,
      issuer: this.issuer,
      isUsable: this.isUsable,
      jwksUri: this.jwksUri,
      notBefore: this.notBefore,
      operations: this.operations,
      ownerId: this.ownerId,
      type: this.type,
      updatedAt: this.updatedAt,
      use: this.use,
    };
  }

  // public methods

  public clone(options: KryptosClone = {}): Kryptos {
    return new Kryptos({
      ...this.toJSON(),
      ...options,
      privateKey: this._privateKey,
      publicKey: this._publicKey,
    });
  }

  public export<K extends KryptosB64>(format: "b64", mode?: KryptosExportMode): K;
  public export<K extends KryptosDer>(format: "der", mode?: KryptosExportMode): K;
  public export<K extends KryptosJwk>(format: "jwk", mode?: KryptosExportMode): K;
  public export<K extends KryptosPem>(format: "pem", mode?: KryptosExportMode): K;
  public export<K extends KryptosRaw>(format: "raw", mode?: KryptosExportMode): K;
  public export<K extends KryptosB64 | KryptosDer | KryptosJwk | KryptosPem | KryptosRaw>(
    format: KryptosFormat,
    mode: KryptosExportMode = "both",
  ): K {
    switch (format) {
      case "b64":
        return this.toBase64Url(mode) as K;

      case "der":
        return this.toDer(mode) as K;

      case "jwk":
        return this.toJwk(mode) as K;

      case "pem":
        return this.toPem(mode) as K;

      case "raw":
        return this.toRaw(mode) as K;

      default:
        throw new KryptosError(`Invalid key format: ${format}`);
    }
  }

  public toJWK(mode: KryptosExportMode = "public"): LindormJwk {
    const keys = this.export<KryptosJwk>("jwk", mode);

    return {
      alg: this.algorithm ?? this.calculateAlgorithm(),
      exp: this.expiresAt ? getUnixTime(this.expiresAt) : undefined,
      iat: getUnixTime(this.createdAt),
      iss: this.issuer,
      jku: this.jwksUri ?? undefined,
      key_ops: this.operations,
      kid: this.id,
      nbf: getUnixTime(this.notBefore),
      owner_id: this.ownerId ?? undefined,
      uat: getUnixTime(this.updatedAt),
      use: this.use ?? "sig",
      ...keys,
    };
  }

  // public static

  public static async generate(type: "EC", options?: GenerateEcOptions): Promise<Kryptos>;
  public static async generate(type: "oct", options?: GenerateOctOptions): Promise<Kryptos>;
  public static async generate(type: "OKP", options?: GenerateOkpOptions): Promise<Kryptos>;
  public static async generate(type: "RSA", options?: GenerateRsaOptions): Promise<Kryptos>;
  public static async generate(type: KryptosType, options: GenerateOptions = {}): Promise<Kryptos> {
    let result: GenerateResult;

    switch (type) {
      case "EC":
        result = await _generateEcKey(options as GenerateEcOptions);
        break;

      case "oct":
        result = await _generateOctKey(options as GenerateOctOptions);
        break;

      case "OKP":
        result = await _generateOkpKey(options as GenerateOkpOptions);
        break;

      case "RSA":
        result = await _generateRsaKey(options as GenerateRsaOptions);
        break;

      default:
        throw new KryptosError(`Invalid key type: ${type}`);
    }

    return new Kryptos({ ...options, ...result, type });
  }

  public static from(format: "b64", b64: KryptosFromB64): Kryptos;
  public static from(format: "der", der: KryptosFromDer): Kryptos;
  public static from(format: "jwk", jwk: KryptosFromJwk): Kryptos;
  public static from(format: "pem", pem: KryptosFromPem): Kryptos;
  public static from(format: "raw", raw: KryptosFromRaw): Kryptos;
  public static from(format: KryptosFormat, arg: KryptosFrom): Kryptos {
    switch (format) {
      case "b64":
        if (!_isB64(arg)) throw new KryptosError("Invalid key format");
        return new Kryptos({ ..._fromStdOptions(arg), ..._fromB64(arg) });

      case "der":
        if (!_isDer(arg)) throw new KryptosError("Invalid key format");
        return new Kryptos({ ..._fromStdOptions(arg), ..._fromDer(arg) });

      case "jwk":
        if (!_isJwk(arg)) throw new KryptosError("Invalid key format");
        return new Kryptos({ ..._fromJwkOptions(arg), ..._fromJwk(arg) });

      case "pem":
        if (!_isPem(arg)) throw new KryptosError("Invalid key format");
        return new Kryptos({ ..._fromStdOptions(arg), ..._fromPem(arg) });

      case "raw":
        if (!_isRaw(arg)) throw new KryptosError("Invalid key format");
        return new Kryptos({ ..._fromStdOptions(arg), ..._fromRaw(arg) });

      default:
        throw new KryptosError("Invalid key format");
    }
  }

  public static isEc(kryptos: any): kryptos is EcKryptos {
    return kryptos instanceof Kryptos && kryptos.type === "EC" && kryptos.curve !== undefined;
  }

  public static isOct(kryptos: any): kryptos is OctKryptos {
    return kryptos instanceof Kryptos && kryptos.type === "oct" && kryptos.curve === undefined;
  }

  public static isOkp(kryptos: any): kryptos is OkpKryptos {
    return kryptos instanceof Kryptos && kryptos.type === "OKP" && kryptos.curve !== undefined;
  }

  public static isRsa(kryptos: any): kryptos is RsaKryptos {
    return kryptos instanceof Kryptos && kryptos.type === "RSA" && kryptos.curve === undefined;
  }

  // private methods

  private toBase64Url(mode: KryptosExportMode): KryptosB64 {
    return {
      ...(this._curve ? { curve: this._curve } : {}),
      ...(mode === "both" && this._privateKey
        ? { privateKey: B64.encode(this._privateKey, "base64url") }
        : {}),
      ...(this._publicKey ? { publicKey: B64.encode(this._publicKey, "base64url") } : {}),
      type: this._type,
    };
  }

  // private export methods

  private toDer(mode: KryptosExportMode): KryptosDer {
    return {
      ...(this._curve ? { curve: this._curve } : {}),
      ...(mode === "both" && this._privateKey ? { privateKey: this._privateKey } : {}),
      ...(this._publicKey ? { publicKey: this._publicKey } : {}),
      type: this._type,
    };
  }

  private toJwk(mode: KryptosExportMode): KryptosJwk {
    switch (this._type) {
      case "EC":
        return _exportEcToJwk(this.formatOptions(mode));

      case "oct":
        return _exportOctToJwk(this.formatOptions(mode));

      case "OKP":
        return _exportOkpToJwk(this.formatOptions(mode));

      case "RSA":
        return _exportRsaToJwk(this.formatOptions(mode));

      default:
        throw new KryptosError("Unexpected key type");
    }
  }

  private toPem(mode: KryptosExportMode): KryptosPem {
    switch (this._type) {
      case "EC":
        return _exportEcToPem(this.formatOptions(mode));

      case "oct":
        return _exportOctToPem(this.formatOptions(mode));

      case "OKP":
        return _exportOkpToPem(this.formatOptions(mode));

      case "RSA":
        return _exportRsaToPem(this.formatOptions(mode));

      default:
        throw new KryptosError("Unexpected key type");
    }
  }

  private toRaw(mode: KryptosExportMode): KryptosRaw {
    switch (this._type) {
      case "EC":
        return _exportEcToRaw(this.formatOptions(mode));

      case "oct":
      case "OKP":
      case "RSA":
        throw new KryptosError("Raw export not supported for this key type");

      default:
        throw new KryptosError("Unexpected key type");
    }
  }

  // private helpers

  private calculateAlgorithm(): KryptosAlgorithm {
    switch (this._type) {
      case "EC":
        if (this._curve === "P-256") return "ES256";
        if (this._curve === "P-384") return "ES384";
        return "ES512";

      case "oct":
        return "HS256";

      case "OKP":
        return "EdDSA";

      case "RSA":
        return "RS256";

      default:
        throw new KryptosError("Unexpected key type");
    }
  }

  private formatOptions(mode: KryptosExportMode): FormatOptions {
    return {
      curve: this._curve,
      mode,
      privateKey: this._privateKey,
      publicKey: this._publicKey,
      type: this._type,
    };
  }
}
