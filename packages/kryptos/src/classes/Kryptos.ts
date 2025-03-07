import { getUnixTime, isAfter, isEqual } from "@lindorm/date";
import { isBuffer } from "@lindorm/is";
import { removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { KryptosError } from "../errors";
import { IKryptos } from "../interfaces";
import {
  KryptosAlgorithm,
  KryptosAttributes,
  KryptosBuffer,
  KryptosCurve,
  KryptosEncryption,
  KryptosExportMode,
  KryptosFormat,
  KryptosJwk,
  KryptosKey,
  KryptosKeys,
  KryptosMetadata,
  KryptosOperation,
  KryptosOptions,
  KryptosString,
  KryptosType,
  KryptosUse,
  LindormJwk,
  RsaModulus,
} from "../types";
import {
  createDerFromDer,
  exportToB64,
  exportToDer,
  exportToJwk,
  exportToPem,
  isOctDer,
  modulusSize,
} from "../utils/private";

export class Kryptos implements IKryptos {
  private readonly _id: string;
  private readonly _algorithm: KryptosAlgorithm;
  private readonly _createdAt: Date;
  private readonly _curve: KryptosCurve | undefined;
  private readonly _encryption: KryptosEncryption | undefined;
  private readonly _isExternal: boolean;
  private readonly _issuer: string | undefined;
  private readonly _jwksUri: string | undefined;
  private readonly _notBefore: Date;
  private readonly _operations: Array<KryptosOperation>;
  private readonly _ownerId: string | undefined;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer | undefined;
  private readonly _type: KryptosType;
  private readonly _use: KryptosUse;

  private _expiresAt: Date | undefined;
  private _updatedAt: Date;

  public constructor(options: KryptosOptions) {
    this._id = options.id || randomUUID();
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._curve = options.curve;
    this._encryption = options.encryption;
    this._expiresAt = options.expiresAt;
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

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get curve(): KryptosCurve | undefined {
    return this._curve;
  }

  public get encryption(): KryptosEncryption | undefined {
    return this._encryption;
  }

  public get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  public set expiresAt(date: Date) {
    this._expiresAt = date;
    this._updatedAt = new Date();
  }

  public get expiresIn(): number {
    if (!this._expiresAt) return -1;
    if (this.isExpired) return 0;
    return getUnixTime(this._expiresAt) - getUnixTime(new Date());
  }

  public get isActive(): boolean {
    return (
      (isEqual(new Date(), this._notBefore) || isAfter(new Date(), this._notBefore)) &&
      !this.isExpired
    );
  }

  public get isExpired(): boolean {
    if (!this._expiresAt) return false;
    return isEqual(new Date(), this._expiresAt) || isAfter(new Date(), this._expiresAt);
  }

  public get isExternal(): boolean {
    return this._isExternal;
  }

  public get issuer(): string | undefined {
    return this._issuer;
  }

  public get jwksUri(): string | undefined {
    return this._jwksUri;
  }

  public get modulus(): RsaModulus | undefined {
    if (this._type !== "RSA") return undefined;
    return modulusSize({ privateKey: this._privateKey, publicKey: this._publicKey! });
  }

  public get notBefore(): Date {
    return this._notBefore;
  }

  public get operations(): Array<KryptosOperation> {
    return this._operations;
  }

  public get ownerId(): string | undefined {
    return this._ownerId;
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

  // metadata

  public get hasPrivateKey(): boolean {
    return isBuffer(this._privateKey) && this._privateKey.length > 0;
  }

  public get hasPublicKey(): boolean {
    return isBuffer(this._publicKey) && this._publicKey.length > 0;
  }

  // public methods

  public export<K extends KryptosString>(format: "b64"): K;
  public export<K extends KryptosBuffer>(format: "der"): K;
  public export<K extends KryptosJwk>(format: "jwk"): K;
  public export<K extends KryptosString>(format: "pem"): K;
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

  // to types

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

  // private methods

  private generateKeys(options: KryptosOptions): KryptosKeys {
    const keys = createDerFromDer(options as KryptosBuffer);

    if (isOctDer(keys)) {
      return { privateKey: keys.privateKey };
    } else {
      return { privateKey: keys.privateKey, publicKey: keys.publicKey };
    }
  }
}
