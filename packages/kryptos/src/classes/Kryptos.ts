import { B64 } from "@lindorm/b64";
import { getUnixTime } from "@lindorm/date";
import { isBuffer } from "@lindorm/is";
import { randomUUID } from "crypto";
import {
  FormatOptions,
  GenerateOptions,
  KryptosAlgorithm,
  KryptosAttributes,
  KryptosB64,
  KryptosCurve,
  KryptosDer,
  KryptosExportMode,
  KryptosFormat,
  KryptosFrom,
  KryptosFromJwk,
  KryptosJwk,
  KryptosOperation,
  KryptosOptions,
  KryptosPem,
  KryptosRaw,
  KryptosType,
  KryptosUse,
  LindormJwk,
} from "../types";
import {
  _exportEcToJwk,
  _exportEcToPem,
  _exportEcToRaw,
  _generateEcKey,
} from "../utils/private/ec";
import { _fromB64, _fromJwk, _fromPem, _fromRaw, _getFromFormat } from "../utils/private/from";
import { _exportOctToJwk, _exportOctToPem, _generateOctKey } from "../utils/private/oct";
import { _exportOkpToJwk, _exportOkpToPem, _generateOkpKey } from "../utils/private/okp";
import { _exportRsaToJwk, _exportRsaToPem, _generateRsaKey } from "../utils/private/rsa";

export class Kryptos implements KryptosAttributes {
  private readonly _id: string;
  private readonly _createdAt: Date;
  private readonly _curve: KryptosCurve | undefined;
  private readonly _isExternal: boolean;
  private readonly _jwksUri: string | undefined;
  private readonly _ownerId: string;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer | undefined;
  private readonly _type: KryptosType;

  private _algorithm: KryptosAlgorithm | undefined;
  private _expiresAt: Date | undefined;
  private _notBefore: Date;
  private _operations: Array<KryptosOperation>;
  private _updatedAt: Date;
  private _use: KryptosUse | undefined;

  public constructor(options: KryptosOptions) {
    this._id = options.id || randomUUID();
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._curve = options.curve ?? undefined;
    this._expiresAt = options.expiresAt ?? undefined;
    this._isExternal = options.isExternal ?? false;
    this._jwksUri = options.jwksUri ?? undefined;
    this._notBefore = options.notBefore ?? new Date();
    this._operations = options.operations ?? [];
    this._ownerId = options.ownerId ?? "";
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
    return Math.round((this._expiresAt.getTime() - Date.now()) / 1000);
  }

  public get isExpired(): boolean {
    if (!this._expiresAt) return false;
    return this._expiresAt.getTime() < Date.now();
  }

  public get isExternal(): boolean {
    return this._isExternal;
  }

  public get jwksUri(): string | undefined {
    return this._jwksUri;
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

  public get ownerId(): string {
    return this._ownerId;
  }

  public get type(): KryptosType {
    return this._type;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get isUsable(): boolean {
    return !this.isExpired && this._notBefore.getTime() < Date.now();
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
      isExpired: this.isExpired,
      isExternal: this.isExternal,
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
        return this._toBase64Url(mode) as K;

      case "der":
        return this._toDer(mode) as K;

      case "jwk":
        return this._toJwk(mode) as K;

      case "pem":
        return this._toPem(mode) as K;

      case "raw":
        return this._toRaw(mode) as K;

      default:
        throw new Error(`Invalid key format: ${format}`);
    }
  }

  public toJWK(mode: KryptosExportMode = "public"): LindormJwk {
    const keys = this.export<KryptosJwk>("jwk", mode);

    return {
      alg: this.algorithm ?? this._calculateAlgorithm(),
      exp: this.expiresAt ? getUnixTime(this.expiresAt) : undefined,
      expires_in: this.expiresIn,
      iat: getUnixTime(this.createdAt),
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

  public static async generate(options: GenerateOptions): Promise<Kryptos> {
    let privateKey: Buffer;
    let publicKey: Buffer | undefined;

    switch (options.type) {
      case "EC":
        ({ privateKey, publicKey } = await _generateEcKey(options));
        break;

      case "oct":
        ({ privateKey } = await _generateOctKey(options));
        break;

      case "OKP":
        ({ privateKey, publicKey } = await _generateOkpKey(options));
        break;

      case "RSA":
        ({ privateKey, publicKey } = await _generateRsaKey(options));
        break;

      default:
        throw new Error(`Invalid key type: ${options.type}`);
    }

    return new Kryptos({ ...options, privateKey, publicKey });
  }

  public static from(b64: KryptosB64, format?: "b64"): Kryptos;
  public static from(der: KryptosDer, format?: "der"): Kryptos;
  public static from(jwk: KryptosFromJwk, format?: "jwk"): Kryptos;
  public static from(pem: KryptosPem, format?: "pem"): Kryptos;
  public static from(raw: KryptosRaw, format?: "raw"): Kryptos;
  public static from(arg: KryptosFrom, format?: KryptosFormat): Kryptos {
    switch (_getFromFormat(arg, format)) {
      case "b64":
        return new Kryptos(_fromB64(arg as KryptosB64));

      case "der":
        return new Kryptos(arg as KryptosDer);

      case "jwk":
        return new Kryptos(_fromJwk(arg as KryptosFromJwk));

      case "pem":
        return new Kryptos(_fromPem(arg as KryptosPem));

      case "raw":
        return new Kryptos(_fromRaw(arg as KryptosRaw));

      default:
        throw new Error("Invalid key format");
    }
  }

  // private methods

  private _toBase64Url(mode: KryptosExportMode): KryptosB64 {
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

  private _toDer(mode: KryptosExportMode): KryptosDer {
    return {
      ...(this._curve ? { curve: this._curve } : {}),
      ...(mode === "both" && this._privateKey ? { privateKey: this._privateKey } : {}),
      ...(this._publicKey ? { publicKey: this._publicKey } : {}),
      type: this._type,
    };
  }

  private _toJwk(mode: KryptosExportMode): KryptosJwk {
    switch (this._type) {
      case "EC":
        return _exportEcToJwk(this._formatOptions(mode));

      case "oct":
        return _exportOctToJwk(this._formatOptions(mode));

      case "OKP":
        return _exportOkpToJwk(this._formatOptions(mode));

      case "RSA":
        return _exportRsaToJwk(this._formatOptions(mode));

      default:
        throw new Error(`Invalid key type: ${this._type}`);
    }
  }

  private _toPem(mode: KryptosExportMode): KryptosPem {
    switch (this._type) {
      case "EC":
        return _exportEcToPem(this._formatOptions(mode));

      case "oct":
        return _exportOctToPem(this._formatOptions(mode));

      case "OKP":
        return _exportOkpToPem(this._formatOptions(mode));

      case "RSA":
        return _exportRsaToPem(this._formatOptions(mode));

      default:
        throw new Error(`Invalid key type: ${this._type}`);
    }
  }

  private _toRaw(mode: KryptosExportMode): KryptosRaw {
    switch (this._type) {
      case "EC":
        return _exportEcToRaw(this._formatOptions(mode));

      case "oct":
      case "OKP":
      case "RSA":
        throw new Error("Raw export not supported for this key type");

      default:
        throw new Error(`Invalid key type: ${this._type}`);
    }
  }

  // private helpers

  private _calculateAlgorithm(): KryptosAlgorithm {
    switch (this._type) {
      case "EC":
        return "ES256";

      case "oct":
        return "HS256";

      case "OKP":
        return "ECDH-ES";

      case "RSA":
        return "RS256";

      default:
        throw new Error(`Invalid key type: ${this._type}`);
    }
  }

  private _formatOptions(mode: KryptosExportMode): FormatOptions {
    return {
      curve: this._curve,
      mode,
      privateKey: this._privateKey,
      publicKey: this._publicKey,
      type: this._type,
    };
  }
}
