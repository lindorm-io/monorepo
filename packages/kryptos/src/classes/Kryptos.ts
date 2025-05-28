import { B64 } from "@lindorm/b64";
import { getUnixTime, isAfter, isEqual } from "@lindorm/date";
import { isBuffer } from "@lindorm/is";
import { removeEmpty, removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { KryptosError } from "../errors";
import { IKryptos } from "../interfaces";
import {
  KryptosAlgorithm,
  KryptosAttributes,
  KryptosBuffer,
  KryptosCurve,
  KryptosDB,
  KryptosEncryption,
  KryptosExportMode,
  KryptosFormat,
  KryptosJSON,
  KryptosJwk,
  KryptosKey,
  KryptosKeys,
  KryptosMetadata,
  KryptosOperation,
  KryptosOptions,
  KryptosPurpose,
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
  private readonly _curve: KryptosCurve | null;
  private readonly _isExternal: boolean;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer | undefined;
  private readonly _type: KryptosType;
  private readonly _use: KryptosUse;

  private _encryption: KryptosEncryption | null;
  private _expiresAt: Date | null;
  private _hidden: boolean;
  private _issuer: string | null;
  private _jwksUri: string | null;
  private _notBefore: Date;
  private _operations: Array<KryptosOperation>;
  private _ownerId: string | null;
  private _purpose: KryptosPurpose | null;
  private _updatedAt: Date;

  public constructor(options: KryptosOptions) {
    this._id = options.id || randomUUID();
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._curve = options.curve || null;
    this._encryption = options.encryption || null;
    this._expiresAt = options.expiresAt || null;
    this._hidden = options.hidden ?? false;
    this._isExternal = options.isExternal ?? false;
    this._issuer = options.issuer || null;
    this._jwksUri = options.jwksUri || null;
    this._notBefore = options.notBefore ?? new Date();
    this._operations = options.operations ?? [];
    this._ownerId = options.ownerId || null;
    this._purpose = options.purpose || null;
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

  public get curve(): KryptosCurve | null {
    return this._curve;
  }

  public get encryption(): KryptosEncryption | null {
    return this._encryption;
  }

  public set encryption(encryption: KryptosEncryption | null) {
    this._encryption = encryption;
    this._updatedAt = new Date();
  }

  public get expiresAt(): Date | null {
    return this._expiresAt;
  }

  public set expiresAt(date: Date) {
    this._expiresAt = date;
    this._updatedAt = new Date();
  }

  public get hidden(): boolean {
    return this._hidden;
  }

  public set hidden(hidden: boolean) {
    this._hidden = hidden;
    this._updatedAt = new Date();
  }

  public get isExternal(): boolean {
    return this._isExternal;
  }

  public get issuer(): string | null {
    return this._issuer;
  }

  public set issuer(issuer: string | null) {
    this._issuer = issuer;
    this._updatedAt = new Date();
  }

  public get jwksUri(): string | null {
    return this._jwksUri;
  }

  public set jwksUri(jwksUri: string | null) {
    this._jwksUri = jwksUri;
    this._updatedAt = new Date();
  }

  public get notBefore(): Date {
    return this._notBefore;
  }

  public set notBefore(notBefore: Date) {
    this._notBefore = notBefore;
    this._updatedAt = new Date();
  }

  public get operations(): Array<KryptosOperation> {
    return this._operations;
  }

  public set operations(operations: Array<KryptosOperation>) {
    this._operations = operations;
    this._updatedAt = new Date();
  }

  public get ownerId(): string | null {
    return this._ownerId;
  }

  public set ownerId(ownerId: string | null) {
    this._ownerId = ownerId;
    this._updatedAt = new Date();
  }

  public get purpose(): KryptosPurpose | null | null {
    return this._purpose;
  }

  public set purpose(purpose: KryptosPurpose | null) {
    this._purpose = purpose;
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

  // metadata

  public get expiresIn(): number {
    if (!this._expiresAt) return -1;
    if (this.isExpired) return 0;
    return getUnixTime(this._expiresAt) - getUnixTime(new Date());
  }

  public get hasPrivateKey(): boolean {
    return isBuffer(this._privateKey) && this._privateKey.length > 0;
  }

  public get hasPublicKey(): boolean {
    return isBuffer(this._publicKey) && this._publicKey.length > 0;
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

  public get modulus(): RsaModulus | null {
    if (this._type !== "RSA") return null;
    return modulusSize({ privateKey: this._privateKey, publicKey: this._publicKey! });
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
          id: this.id,
          algorithm: this.algorithm,
          curve: this.curve ?? undefined,
          privateKey: this._privateKey,
          publicKey: this._publicKey,
          type: this.type,
          use: this.use,
        });

      case "der":
        return exportToDer({
          id: this.id,
          algorithm: this.algorithm,
          curve: this.curve ?? undefined,
          privateKey: this._privateKey,
          publicKey: this._publicKey,
          type: this.type,
          use: this.use,
        });

      case "jwk":
        return exportToJwk({
          id: this.id,
          algorithm: this.algorithm,
          curve: this.curve ?? undefined,
          mode: "private",
          privateKey: this._privateKey,
          publicKey: this._publicKey,
          type: this.type,
          use: this.use,
        });

      case "pem":
        return exportToPem({
          id: this.id,
          algorithm: this.algorithm,
          curve: this.curve ?? undefined,
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

  public toDB(): KryptosDB {
    const { privateKey, publicKey } = this.export("b64");
    return {
      id: this.id,
      algorithm: this.algorithm,
      createdAt: this.createdAt,
      curve: this.curve!,
      encryption: this.encryption!,
      expiresAt: this.expiresAt,
      hidden: this.hidden,
      isExternal: this.isExternal,
      issuer: this.issuer,
      jwksUri: this.jwksUri,
      notBefore: this.notBefore,
      operations: this.operations,
      ownerId: this.ownerId,
      purpose: this.purpose,
      type: this.type,
      updatedAt: this.updatedAt,
      use: this.use,
      privateKey,
      publicKey,
    };
  }

  public toJSON(): KryptosJSON {
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
      hidden: this.hidden,
      isActive: this.isActive,
      isExpired: this.isExpired,
      isExternal: this.isExternal,
      issuer: this.issuer,
      jwksUri: this.jwksUri,
      modulus: this.modulus,
      notBefore: this.notBefore,
      operations: this.operations,
      ownerId: this.ownerId,
      purpose: this.purpose,
      type: this.type,
      updatedAt: this.updatedAt,
      use: this.use,
    });
  }

  public toJWK(mode: KryptosExportMode = "public"): LindormJwk {
    const keys = exportToJwk({
      id: this.id,
      algorithm: this.algorithm,
      curve: this.curve ?? undefined,
      mode: mode,
      privateKey: this._privateKey,
      publicKey: this._publicKey,
      type: this.type,
      use: this.use,
    });

    return removeEmpty({
      ...keys,
      enc: this.encryption ?? undefined,
      exp: this.expiresAt ? getUnixTime(this.expiresAt) : undefined,
      iat: getUnixTime(this.createdAt),
      iss: this.issuer ?? undefined,
      jku: this.jwksUri ?? undefined,
      key_ops: this.operations,
      nbf: getUnixTime(this.notBefore),
      owner_id: this.ownerId ?? undefined,
      purpose: this.purpose ?? undefined,
      uat: getUnixTime(this.updatedAt),
    });
  }

  public toString(): string {
    return "kryptos:" + B64.encode(JSON.stringify(this.toJWK("private")), "b64u");
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
