import { randomUUID } from "crypto";
import { JwkError } from "../errors";
import {
  CreateKeySetOptions,
  EcKeySetB64,
  EcKeySetDer,
  EcKeySetJwk,
  EcKeySetPem,
  ExternalJwk,
  GenerateEcOptions,
  GenerateOctOptions,
  GenerateOkpOptions,
  GenerateOptions,
  GenerateRsaOptions,
  KeySet,
  KeySetAlgorithm,
  KeySetB64,
  KeySetCurve,
  KeySetDer,
  KeySetExportFormat,
  KeySetExportKeys,
  KeySetJwk,
  KeySetOperations,
  KeySetPem,
  KeySetType,
  KeySetUsage,
  LindormJwk,
  OctKeySetB64,
  OctKeySetDer,
  OctKeySetJwk,
  OctKeySetPem,
  OkpKeySetB64,
  OkpKeySetDer,
  OkpKeySetJwk,
  OkpKeySetPem,
  RsaKeySetB64,
  RsaKeySetDer,
  RsaKeySetJwk,
  RsaKeySetPem,
  WebKeySetMetadata,
  WebKeySetOptions,
} from "../types";
import { getUnixTime } from "../utils/private";
import { EcKeySet } from "./EcKeySet";
import { OctKeySet } from "./OctKeySet";
import { OkpKeySet } from "./OkpKeySet";
import { RsaKeySet } from "./RsaKeySet";

export class WebKeySet {
  // public
  public readonly keySet: KeySet;

  // private readonly
  private readonly _algorithm: KeySetAlgorithm;
  private readonly _createdAt: Date;
  private readonly _isExternal: boolean;
  private readonly _jwkUri: string | undefined;
  private readonly _ownerId: string | undefined;
  private readonly _type: KeySetType;
  private readonly _use: KeySetUsage;

  // private
  _expiresAt: Date | undefined;
  _notBefore: Date;
  _operations: Array<KeySetOperations>;
  _updatedAt: Date;

  public constructor(options: WebKeySetOptions) {
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._expiresAt = options.expiresAt;
    this._isExternal = options.isExternal ?? false;
    this._jwkUri = options.jwkUri;
    this._notBefore = options.notBefore ?? new Date();
    this._operations = options.operations ?? [];
    this._ownerId = options.ownerId;
    this._type = options.type;
    this._updatedAt = options.updatedAt ?? options.createdAt ?? new Date();
    this._use = options.use;

    this.keySet = WebKeySet.createKeySet({
      ...options,
      id: options.id ?? randomUUID(),
    } as KeySetDer);
  }

  // getters and setters

  public get id(): string {
    return this.keySet.id;
  }

  public get algorithm(): KeySetAlgorithm {
    return this._algorithm;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }

  public get curve(): KeySetCurve | undefined {
    if (WebKeySet.isEcKeySet(this.keySet) || WebKeySet.isOkpKeySet(this.keySet)) {
      return this.keySet.curve;
    }
    return undefined;
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

  public get isExternal(): boolean {
    return this._isExternal;
  }

  public get jwkUri(): string | undefined {
    return this._jwkUri;
  }

  public get notBefore(): Date {
    return this._notBefore;
  }

  public set notBefore(date: Date) {
    this._notBefore = date;
    this._updatedAt = new Date();
  }

  public get operations(): Array<KeySetOperations> {
    return this._operations;
  }

  public set operations(operations: Array<KeySetOperations>) {
    this._operations = operations;
    this._updatedAt = new Date();
  }

  public get ownerId(): string | undefined {
    return this._ownerId;
  }

  public get type(): KeySetType {
    return this._type;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  public get use(): KeySetUsage {
    return this._use;
  }

  // extra getters

  public get metadata(): WebKeySetMetadata {
    return {
      id: this.id,
      algorithm: this.algorithm,
      createdAt: this.createdAt,
      curve: this.curve,
      expiresAt: this.expiresAt,
      expiresIn: this.expiresIn,
      isExternal: this.isExternal,
      jwkUri: this.jwkUri,
      notBefore: this.notBefore,
      operations: this.operations,
      ownerId: this.ownerId,
      type: this.type,
      updatedAt: this.updatedAt,
      use: this.use,
    };
  }

  public get hasPrivateKey(): boolean {
    return this.keySet.hasPrivateKey;
  }

  public get hasPublicKey(): boolean {
    return this.keySet.hasPublicKey;
  }

  // public methods

  public export<D extends KeySetB64>(format: "b64", keys?: KeySetExportKeys): D;
  public export<D extends KeySetDer>(format: "der", keys?: KeySetExportKeys): D;
  public export<J extends KeySetJwk>(format: "jwk", keys?: KeySetExportKeys): J;
  public export<P extends KeySetPem>(format: "pem", keys?: KeySetExportKeys): P;
  public export<T extends KeySetB64 | KeySetDer | KeySetJwk | KeySetPem>(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): T {
    return this.keySet.export(format as any, keys) as T;
  }

  public jwk(keys: KeySetExportKeys = "public"): LindormJwk {
    const jwk = this.keySet.export("jwk", keys);
    return {
      alg: this.algorithm,
      exp: this.expiresAt ? getUnixTime(this.expiresAt) : undefined,
      expires_in: this.expiresIn,
      iat: getUnixTime(this.createdAt),
      jku: this.jwkUri ?? undefined,
      key_ops: this.operations,
      nbf: getUnixTime(this.notBefore),
      owner_id: this.ownerId ?? undefined,
      uat: getUnixTime(this.updatedAt),
      use: this.use,
      ...jwk,
    };
  }

  // public static methods

  public static async generate(options: GenerateOptions): Promise<WebKeySet> {
    if (options.type === "EC") {
      const curve = (options as GenerateEcOptions).curve;
      const keySet = await EcKeySet.generate(curve);
      const der = keySet.export("der");

      return new WebKeySet({ ...options, publicKey: der.publicKey, privateKey: der.privateKey });
    }

    if (options.type === "OKP") {
      const curve = (options as GenerateOkpOptions).curve;
      const keySet = await OkpKeySet.generate(curve);
      const der = keySet.export("der");

      return new WebKeySet({ ...options, publicKey: der.publicKey, privateKey: der.privateKey });
    }

    if (options.type === "RSA") {
      const modulus = (options as GenerateRsaOptions).modulus;
      const keySet = await RsaKeySet.generate(modulus);
      const der = keySet.export("der");

      return new WebKeySet({ ...options, publicKey: der.publicKey, privateKey: der.privateKey });
    }

    if (options.type === "oct") {
      const size = (options as GenerateOctOptions).size;
      const keySet = await OctKeySet.generate(size);
      const der = keySet.export("der");

      return new WebKeySet({ ...options, privateKey: der.privateKey });
    }

    throw new JwkError("Unsupported key type");
  }

  public static fromJwk(jwk: ExternalJwk): WebKeySet {
    let options: WebKeySetOptions = {
      id: jwk.kid,
      algorithm: jwk.alg,
      expiresAt: jwk.exp ? new Date(jwk.exp * 1000) : undefined,
      isExternal: true,
      jwkUri: jwk.jku,
      notBefore: jwk.nbf ? new Date(jwk.nbf * 1000) : new Date(),
      operations: jwk.key_ops ?? [],
      ownerId: jwk.owner_id,
      publicKey: Buffer.alloc(0),
      type: jwk.kty,
      use: jwk.use,
    };

    if (jwk.kty === "EC") {
      const der = EcKeySet.fromJwk(jwk).export("der");

      options = {
        ...options,
        curve: der.curve,
        privateKey: der.privateKey,
        publicKey: der.publicKey,
      };
    }

    if (jwk.kty === "OKP") {
      const der = OkpKeySet.fromJwk(jwk).export("der");

      options = {
        ...options,
        curve: der.curve,
        privateKey: der.privateKey,
        publicKey: der.publicKey,
      };
    }

    if (jwk.kty === "RSA") {
      const der = RsaKeySet.fromJwk(jwk).export("der");

      options = { ...options, privateKey: der.privateKey, publicKey: der.publicKey };
    }

    if (jwk.kty === "oct") {
      const der = OctKeySet.fromJwk(jwk).export("der");

      options = { ...options, privateKey: der.privateKey };
    }

    return new WebKeySet(options);
  }

  public static createKeySet<K extends KeySet>(options: CreateKeySetOptions): K {
    const type = WebKeySet.isB64(options)
      ? options.type
      : WebKeySet.isDer(options)
      ? options.type
      : WebKeySet.isPem(options)
      ? options.type
      : WebKeySet.isJwk(options)
      ? options.kty
      : undefined;

    if (!type) {
      throw new JwkError("Invalid input", { debug: { options } });
    }

    switch (type) {
      case "EC":
        if (WebKeySet.isEcB64(options)) {
          return EcKeySet.fromB64(options) as K;
        }
        if (WebKeySet.isEcDer(options)) {
          return EcKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isEcPem(options)) {
          return EcKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isEcJwk(options)) {
          return EcKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      case "OKP":
        if (WebKeySet.isOkpB64(options)) {
          return OkpKeySet.fromB64(options) as K;
        }
        if (WebKeySet.isOkpDer(options)) {
          return OkpKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isOkpPem(options)) {
          return OkpKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isOkpJwk(options)) {
          return OkpKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      case "RSA":
        if (WebKeySet.isRsaB64(options)) {
          return RsaKeySet.fromB64(options) as K;
        }
        if (WebKeySet.isRsaDer(options)) {
          return RsaKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isRsaPem(options)) {
          return RsaKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isRsaJwk(options)) {
          return RsaKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      case "oct":
        if (WebKeySet.isOctB64(options)) {
          return OctKeySet.fromB64(options) as K;
        }
        if (WebKeySet.isOctDer(options)) {
          return OctKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isOctPem(options)) {
          return OctKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isOctJwk(options)) {
          return OctKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      default:
        throw new JwkError("Unsupported key type");
    }
  }

  // public static type guards

  public static isKeySet<K extends KeySet>(keySet: unknown): keySet is K {
    return (
      WebKeySet.isEcKeySet(keySet) ||
      WebKeySet.isOctKeySet(keySet) ||
      WebKeySet.isOkpKeySet(keySet) ||
      WebKeySet.isRsaKeySet(keySet)
    );
  }

  public static isB64(b64: unknown): b64 is KeySetB64 {
    return (
      WebKeySet.isEcB64(b64) ||
      WebKeySet.isOctB64(b64) ||
      WebKeySet.isOkpB64(b64) ||
      WebKeySet.isRsaB64(b64)
    );
  }

  public static isDer(der: unknown): der is KeySetDer {
    return (
      WebKeySet.isEcDer(der) ||
      WebKeySet.isOctDer(der) ||
      WebKeySet.isOkpDer(der) ||
      WebKeySet.isRsaDer(der)
    );
  }

  public static isJwk(jwk: unknown): jwk is KeySetJwk {
    return (
      WebKeySet.isEcJwk(jwk) ||
      WebKeySet.isOctJwk(jwk) ||
      WebKeySet.isOkpJwk(jwk) ||
      WebKeySet.isRsaJwk(jwk)
    );
  }

  public static isPem(pem: unknown): pem is KeySetPem {
    return (
      WebKeySet.isEcPem(pem) ||
      WebKeySet.isOctPem(pem) ||
      WebKeySet.isOkpPem(pem) ||
      WebKeySet.isRsaPem(pem)
    );
  }

  // EC

  public static isEcKeySet(keySet: unknown): keySet is EcKeySet {
    return keySet instanceof EcKeySet;
  }

  public static isEcB64(b64: unknown): b64 is EcKeySetB64 {
    return EcKeySet.isB64(b64);
  }

  public static isEcDer(der: unknown): der is EcKeySetDer {
    return EcKeySet.isDer(der);
  }

  public static isEcJwk(jwk: unknown): jwk is EcKeySetJwk {
    return EcKeySet.isJwk(jwk);
  }

  public static isEcPem(pem: unknown): pem is EcKeySetPem {
    return EcKeySet.isPem(pem);
  }

  // OCT

  public static isOctKeySet(keySet: unknown): keySet is OctKeySet {
    return keySet instanceof OctKeySet;
  }

  public static isOctB64(b64: unknown): b64 is OctKeySetB64 {
    return OctKeySet.isB64(b64);
  }

  public static isOctDer(der: unknown): der is OctKeySetDer {
    return OctKeySet.isDer(der);
  }

  public static isOctJwk(jwk: unknown): jwk is OctKeySetJwk {
    return OctKeySet.isJwk(jwk);
  }

  public static isOctPem(pem: unknown): pem is OctKeySetPem {
    return OctKeySet.isPem(pem);
  }

  // OKP

  public static isOkpKeySet(keySet: unknown): keySet is OkpKeySet {
    return keySet instanceof OkpKeySet;
  }

  public static isOkpB64(b64: unknown): b64 is OkpKeySetB64 {
    return OkpKeySet.isB64(b64);
  }

  public static isOkpDer(der: unknown): der is OkpKeySetDer {
    return OkpKeySet.isDer(der);
  }

  public static isOkpJwk(jwk: unknown): jwk is OkpKeySetJwk {
    return OkpKeySet.isJwk(jwk);
  }

  public static isOkpPem(pem: unknown): pem is OkpKeySetPem {
    return OkpKeySet.isPem(pem);
  }

  // RSA

  public static isRsaKeySet(keySet: unknown): keySet is RsaKeySet {
    return keySet instanceof RsaKeySet;
  }

  public static isRsaB64(b64: unknown): b64 is RsaKeySetB64 {
    return RsaKeySet.isB64(b64);
  }

  public static isRsaDer(der: unknown): der is RsaKeySetDer {
    return RsaKeySet.isDer(der);
  }

  public static isRsaJwk(jwk: unknown): jwk is RsaKeySetJwk {
    return RsaKeySet.isJwk(jwk);
  }

  public static isRsaPem(pem: unknown): pem is RsaKeySetPem {
    return RsaKeySet.isPem(pem);
  }
}
