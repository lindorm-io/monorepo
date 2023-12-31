import { randomUUID } from "crypto";
import { JwkError } from "../errors";
import {
  CreateKeySetOptions,
  EcKeySetDer,
  EcKeySetJwk,
  EcKeySetPem,
  ExternalJwk,
  GenerateEcOptions,
  GenerateOctOptions,
  GenerateOkpOptions,
  GenerateOptions,
  GenerateRsaOptions,
  JwkOperations,
  JwkType,
  JwkUsage,
  KeySet,
  KeySetAlgorithm,
  KeySetDer,
  KeySetExportFormat,
  KeySetExportKeys,
  KeySetJwk,
  KeySetPem,
  LindormJwk,
  OctKeySetDer,
  OctKeySetJwk,
  OctKeySetPem,
  OkpKeySetDer,
  OkpKeySetJwk,
  OkpKeySetPem,
  RsaKeySetDer,
  RsaKeySetJwk,
  RsaKeySetPem,
  WebKeySetOptions,
} from "../types";
import { getUnixTime } from "../utils/private";
import { EcKeySet } from "./EcKeySet";
import { OctKeySet } from "./OctKeySet";
import { OkpKeySet } from "./OkpKeySet";
import { RsaKeySet } from "./RsaKeySet";

const TYPES = ["EC", "OKP", "RSA", "oct"] as const;

export class WebKeySet {
  // private readonly
  readonly #algorithm: KeySetAlgorithm;
  readonly #createdAt: Date;
  readonly #expiresAt: Date | undefined;
  readonly #isExternal: boolean;
  readonly #jwkUri: string | undefined;
  readonly #notBefore: Date;
  readonly #operations: Array<JwkOperations>;
  readonly #ownerId: string | undefined;
  readonly #type: JwkType;
  readonly #use: JwkUsage;

  // generated
  readonly #keySet: KeySet;

  public constructor(options: WebKeySetOptions) {
    this.#algorithm = options.algorithm;
    this.#createdAt = options.createdAt ?? new Date();
    this.#expiresAt = options.expiresAt;
    this.#isExternal = options.isExternal ?? false;
    this.#jwkUri = options.jwkUri;
    this.#notBefore = options.notBefore ?? new Date();
    this.#operations = options.operations ?? [];
    this.#ownerId = options.ownerId;
    this.#type = options.type;
    this.#use = options.use;

    this.#keySet = WebKeySet.createKeySet({
      ...options,
      keyId: options.keyId ?? randomUUID(),
    } as KeySetDer);
  }

  // getters and setters

  public get algorithm(): KeySetAlgorithm {
    return this.#algorithm;
  }

  public get createdAt(): Date {
    return this.#createdAt;
  }

  public get expiresAt(): Date | undefined {
    return this.#expiresAt;
  }

  public get isExternal(): boolean {
    return this.#isExternal;
  }

  public get jwkUri(): string | undefined {
    return this.#jwkUri;
  }

  public get keyId(): string {
    if (!this.#keySet.id) {
      throw new JwkError("Unexpected error", { debug: { keySet: this.#keySet } });
    }
    return this.#keySet.id;
  }

  public get notBefore(): Date {
    return this.#notBefore;
  }

  public get operations(): Array<JwkOperations> {
    return this.#operations;
  }

  public get ownerId(): string | undefined {
    return this.#ownerId;
  }

  public get type(): JwkType {
    return this.#type;
  }

  public get use(): JwkUsage {
    return this.#use;
  }

  // public methods

  public export<D extends KeySetDer>(format: "der", keys?: KeySetExportKeys): D;
  public export<J extends KeySetJwk>(format: "jwk", keys?: KeySetExportKeys): J;
  public export<P extends KeySetPem>(format: "pem", keys?: KeySetExportKeys): P;
  public export<T extends KeySetDer | KeySetJwk | KeySetPem>(
    format: KeySetExportFormat,
    keys: KeySetExportKeys = "both",
  ): T {
    return this.#keySet.export(format as any, keys) as T;
  }

  public toJwk(): LindormJwk {
    const jwk = this.#keySet.export("jwk");

    return {
      alg: this.algorithm,
      created_at: getUnixTime(this.createdAt),
      expires_at: this.expiresAt ? getUnixTime(this.expiresAt) : undefined,
      jwk_uri: this.jwkUri ?? undefined,
      key_ops: this.operations,
      kid: this.keyId,
      not_before: this.notBefore.getTime(),
      owner_id: this.ownerId ?? undefined,
      use: this.use,
      ...jwk,
    };
  }

  public keySet<K extends KeySet>(): K {
    return this.#keySet as K;
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
      algorithm: jwk.alg,
      expiresAt: jwk.expires_at ? new Date(jwk.expires_at) : undefined,
      isExternal: true,
      jwkUri: jwk.jwk_uri,
      notBefore: jwk.not_before ? new Date(jwk.not_before) : new Date(),
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
    const type = WebKeySet.isDer(options)
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
        if (WebKeySet.isDer(options) && WebKeySet.isEcDer(options)) {
          return EcKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isPem(options) && WebKeySet.isEcPem(options)) {
          return EcKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isJwk(options) && WebKeySet.isEcJwk(options)) {
          return EcKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      case "OKP":
        if (WebKeySet.isDer(options) && WebKeySet.isOkpDer(options)) {
          return OkpKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isPem(options) && WebKeySet.isOkpPem(options)) {
          return OkpKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isJwk(options) && WebKeySet.isOkpJwk(options)) {
          return OkpKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      case "RSA":
        if (WebKeySet.isDer(options) && WebKeySet.isRsaDer(options)) {
          return RsaKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isPem(options) && WebKeySet.isRsaPem(options)) {
          return RsaKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isJwk(options) && WebKeySet.isRsaJwk(options)) {
          return RsaKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      case "oct":
        if (WebKeySet.isDer(options) && WebKeySet.isOctDer(options)) {
          return OctKeySet.fromDer(options) as K;
        }
        if (WebKeySet.isPem(options) && WebKeySet.isOctPem(options)) {
          return OctKeySet.fromPem(options) as K;
        }
        if (WebKeySet.isJwk(options) && WebKeySet.isOctJwk(options)) {
          return OctKeySet.fromJwk(options) as K;
        }
        throw new JwkError("Invalid input", { debug: { options } });

      default:
        throw new JwkError("Unsupported key type");
    }
  }

  // public static type guards

  public static isKeySet<K extends KeySet>(keySet: any): keySet is K {
    return (
      WebKeySet.isEcKeySet(keySet) ||
      WebKeySet.isOctKeySet(keySet) ||
      WebKeySet.isOkpKeySet(keySet) ||
      WebKeySet.isRsaKeySet(keySet)
    );
  }

  public static isDer(input: any): input is KeySetDer {
    return (
      typeof input === "object" &&
      TYPES.includes(input.type) &&
      (Buffer.isBuffer(input.publicKey) || Buffer.isBuffer(input.privateKey))
    );
  }

  public static isJwk(input: any): input is KeySetJwk {
    return (
      typeof input === "object" &&
      TYPES.includes(input.kty) &&
      (typeof input.e === "string" ||
        typeof input.x === "string" ||
        typeof input.k === "string" ||
        typeof input.d === "string" ||
        typeof input.n === "string" ||
        typeof input.y === "string")
    );
  }

  public static isPem(input: any): input is KeySetPem {
    return (
      typeof input === "object" &&
      TYPES.includes(input.type) &&
      (typeof input.publicKey === "string" || typeof input.privateKey === "string")
    );
  }

  // EC

  public static isEcKeySet(keySet: KeySet): keySet is EcKeySet {
    return keySet instanceof EcKeySet;
  }

  public static isEcDer(der: KeySetDer): der is EcKeySetDer {
    return EcKeySet.isDer(der);
  }

  public static isEcJwk(jwk: KeySetJwk): jwk is EcKeySetJwk {
    return EcKeySet.isJwk(jwk);
  }

  public static isEcPem(pem: KeySetPem): pem is EcKeySetPem {
    return EcKeySet.isPem(pem);
  }

  // OCT

  public static isOctKeySet(keySet: KeySet): keySet is OctKeySet {
    return keySet instanceof OctKeySet;
  }

  public static isOctDer(der: KeySetDer): der is OctKeySetDer {
    return OctKeySet.isDer(der);
  }

  public static isOctJwk(jwk: KeySetJwk): jwk is OctKeySetJwk {
    return OctKeySet.isJwk(jwk);
  }

  public static isOctPem(pem: KeySetPem): pem is OctKeySetPem {
    return OctKeySet.isPem(pem);
  }

  // OKP

  public static isOkpKeySet(keySet: KeySet): keySet is OkpKeySet {
    return keySet instanceof OkpKeySet;
  }

  public static isOkpDer(der: KeySetDer): der is OkpKeySetDer {
    return OkpKeySet.isDer(der);
  }

  public static isOkpJwk(jwk: KeySetJwk): jwk is OkpKeySetJwk {
    return OkpKeySet.isJwk(jwk);
  }

  public static isOkpPem(pem: KeySetPem): pem is OkpKeySetPem {
    return OkpKeySet.isPem(pem);
  }

  // RSA

  public static isRsaKeySet(keySet: KeySet): keySet is RsaKeySet {
    return keySet instanceof RsaKeySet;
  }

  public static isRsaDer(der: KeySetDer): der is RsaKeySetDer {
    return RsaKeySet.isDer(der);
  }

  public static isRsaJwk(jwk: KeySetJwk): jwk is RsaKeySetJwk {
    return RsaKeySet.isJwk(jwk);
  }

  public static isRsaPem(pem: KeySetPem): pem is RsaKeySetPem {
    return RsaKeySet.isPem(pem);
  }
}
