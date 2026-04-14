import { B64 } from "@lindorm/b64";
import { getUnixTime, isAfter, isEqual } from "@lindorm/date";
import { isBuffer } from "@lindorm/is";
import { removeEmpty, removeUndefined } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { KryptosError } from "../errors";
import { IKryptos } from "../interfaces";
import {
  KryptosAlgorithm,
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
  KryptosOperation,
  KryptosOptions,
  KryptosString,
  KryptosType,
  KryptosUse,
  LindormJwk,
  ParsedX509Certificate,
  RsaModulus,
} from "../types";
import { ExportCache } from "#internal/types/export-cache";
import { computeThumbprint } from "#internal/utils/compute-thumbprint";
import { createDerFromDer } from "#internal/utils/from/der-from-der";
import { exportToB64 } from "#internal/utils/export/export-b64";
import { exportToDer } from "#internal/utils/export/export-der";
import { exportToJwk } from "#internal/utils/export/export-jwk";
import { exportToPem } from "#internal/utils/export/export-pem";
import { isOctDer } from "#internal/utils/oct/is";
import { modulusSize } from "#internal/utils/rsa/modulus-size";
import { extractLeafSpki } from "#internal/utils/x509/extract-leaf-spki";
import { parseX509Certificate } from "#internal/utils/x509/parse-certificate";
import { parseX509 } from "#internal/utils/x509/parse-x509";
import { verifyX509Chain } from "#internal/utils/x509/verify-chain";
import { x509PublicKeyMatches } from "#internal/utils/x509/x509-public-key-matches";
import { x5tS256 as x5tS256Thumbprint } from "#internal/utils/x509/x509-thumbprints";

export class Kryptos implements IKryptos {
  private readonly _id: string;
  private readonly _algorithm: KryptosAlgorithm;
  private readonly _createdAt: Date;
  private readonly _curve: KryptosCurve | null;
  private readonly _isExternal: boolean;
  private readonly _modulus: RsaModulus | null;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer | undefined;
  private readonly _type: KryptosType;
  private readonly _use: KryptosUse;
  private readonly _certificateChain: ReadonlyArray<Buffer> | undefined;
  private readonly _encryption: KryptosEncryption | null;
  private readonly _expiresAt: Date;
  private readonly _hidden: boolean;
  private readonly _issuer: string | null;
  private readonly _jwksUri: string | null;
  private readonly _notBefore: Date;
  private readonly _operations: ReadonlyArray<KryptosOperation>;
  private readonly _ownerId: string | null;
  private readonly _purpose: string | null;

  private _cache: ExportCache = {};
  private _disposed: boolean = false;

  public constructor(options: KryptosOptions) {
    this._id = options.id || randomUUID();
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._curve = options.curve || null;
    this._encryption = options.encryption || null;
    this._notBefore = options.notBefore ?? new Date();
    this._expiresAt =
      options.expiresAt ??
      new Date(this._notBefore.getTime() + 25 * 365.25 * 24 * 60 * 60 * 1000);
    this._hidden = options.hidden ?? false;
    this._isExternal = options.isExternal ?? false;
    this._issuer = options.issuer || null;
    this._jwksUri = options.jwksUri || null;
    this._operations = options.operations ?? [];
    this._ownerId = options.ownerId || null;
    this._purpose = options.purpose || null;
    this._type = options.type;
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

    this._modulus =
      options.modulus ??
      (this._type === "RSA" && (this._privateKey || this._publicKey)
        ? modulusSize({ privateKey: this._privateKey, publicKey: this._publicKey! })
        : null);

    const hasCertChainInput =
      options.certificateChain != null &&
      (typeof options.certificateChain === "string" ||
        options.certificateChain.length > 0);

    if (hasCertChainInput) {
      if (!this._publicKey || this._publicKey.length === 0) {
        throw new KryptosError(
          "certificateChain requires a kryptos with a public key (oct keys are not supported)",
        );
      }

      const ders = parseX509(options.certificateChain!);
      const leafSpki = extractLeafSpki(ders[0]);

      if (!x509PublicKeyMatches(leafSpki, this._publicKey, this._type)) {
        throw new KryptosError(
          "certificateChain leaf certificate public key does not match kryptos public key",
        );
      }

      this._certificateChain = ders;
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

  public get expiresAt(): Date {
    return this._expiresAt;
  }

  public get hidden(): boolean {
    return this._hidden;
  }

  public get isExternal(): boolean {
    return this._isExternal;
  }

  public get issuer(): string | null {
    return this._issuer;
  }

  public get jwksUri(): string | null {
    return this._jwksUri;
  }

  public get notBefore(): Date {
    return this._notBefore;
  }

  public get operations(): Array<KryptosOperation> {
    return [...this._operations];
  }

  public get ownerId(): string | null {
    return this._ownerId;
  }

  public get purpose(): string | null {
    return this._purpose;
  }

  public get type(): KryptosType {
    return this._type;
  }

  public get use(): KryptosUse {
    return this._use;
  }

  // metadata

  public get expiresIn(): number {
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
    return isEqual(new Date(), this._expiresAt) || isAfter(new Date(), this._expiresAt);
  }

  public get modulus(): RsaModulus | null {
    return this._modulus;
  }

  public get thumbprint(): string {
    this.assertNotDisposed();
    return computeThumbprint(this.export("jwk"));
  }

  // x509

  public get hasCertificate(): boolean {
    return this._certificateChain !== undefined && this._certificateChain.length > 0;
  }

  public get certificate(): ParsedX509Certificate | null {
    if (!this._certificateChain || this._certificateChain.length === 0) return null;
    if (!this._cache.parsedLeaf) {
      this._cache.parsedLeaf = parseX509Certificate(this._certificateChain[0]);
    }
    return this._cache.parsedLeaf;
  }

  public get certificateChain(): Array<string> {
    if (!this._certificateChain) return [];
    return this._certificateChain.map((der) => der.toString("base64"));
  }

  public get certificateThumbprint(): string | null {
    if (!this._certificateChain || this._certificateChain.length === 0) return null;
    return x5tS256Thumbprint(this._certificateChain[0]);
  }

  public verifyCertificate(options: { trustAnchors: string | Array<string> }): void {
    this.assertNotDisposed();

    if (!this._certificateChain) {
      throw new KryptosError("Kryptos has no certificate to verify");
    }

    verifyX509Chain(this._certificateChain, options.trustAnchors);
  }

  // dispose

  public dispose(): void {
    if (this._disposed) return;

    if (this._privateKey) this._privateKey.fill(0);
    if (this._publicKey) this._publicKey.fill(0);

    this._cache = {};
    this._disposed = true;
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }

  // public methods

  public export<K extends KryptosString>(format: "b64"): K;
  public export<K extends KryptosBuffer>(format: "der"): K;
  public export<K extends KryptosJwk>(format: "jwk"): K;
  public export<K extends KryptosString>(format: "pem"): K;
  public export(format: KryptosFormat): KryptosKey {
    this.assertNotDisposed();

    const exportOptions = {
      id: this.id,
      algorithm: this.algorithm,
      curve: this.curve ?? undefined,
      privateKey: this._privateKey,
      publicKey: this._publicKey,
      type: this.type,
      use: this.use,
    };

    const metadata = {
      id: this.id,
      algorithm: this.algorithm,
      ...(this.curve ? { curve: this.curve } : {}),
      ...(this.encryption ? { encryption: this.encryption } : {}),
      type: this.type,
      use: this.use,
    };

    switch (format) {
      case "b64": {
        if (!this._cache.b64) {
          const result = exportToB64(exportOptions);
          this._cache.b64 = Object.freeze(
            removeUndefined({
              privateKey: result.privateKey,
              publicKey: result.publicKey,
            }),
          );
        }
        return { ...metadata, ...this._cache.b64 } as KryptosString;
      }

      case "der": {
        const result = exportToDer(exportOptions);
        return {
          ...metadata,
          ...result,
          privateKey: result.privateKey
            ? Buffer.from(result.privateKey)
            : result.privateKey,
          publicKey: result.publicKey ? Buffer.from(result.publicKey) : result.publicKey,
        } as KryptosBuffer;
      }

      case "jwk": {
        if (!this._cache.jwkPrivate) {
          const { kid, alg, kty, use, enc, ...keys } = exportToJwk({
            ...exportOptions,
            mode: "private",
          });
          this._cache.jwkPrivate = Object.freeze(keys);
        }
        return removeUndefined({
          ...this._cache.jwkPrivate,
          kid: this.id,
          alg: this.algorithm,
          ...(this.encryption ? { enc: this.encryption } : {}),
          use: this.use,
          kty: this.type,
        }) as KryptosJwk;
      }

      case "pem": {
        if (!this._cache.pem) {
          const result = exportToPem(exportOptions);
          this._cache.pem = Object.freeze(
            removeUndefined({
              privateKey: result.privateKey,
              publicKey: result.publicKey,
            }),
          );
        }
        return { ...metadata, ...this._cache.pem } as KryptosString;
      }

      default:
        throw new KryptosError(`Invalid key format: ${format}`);
    }
  }

  // to types

  public toDB(): KryptosDB {
    this.assertNotDisposed();

    const { privateKey, publicKey } = this.export("b64");
    return removeUndefined<KryptosDB>({
      id: this.id,
      algorithm: this.algorithm,
      certificateChain: this.certificateChain,
      certificateThumbprint: this.certificateThumbprint,
      createdAt: this.createdAt,
      curve: this.curve,
      encryption: this.encryption,
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
      use: this.use,
      privateKey,
      publicKey,
    });
  }

  public toEnvString(): string {
    this.assertNotDisposed();

    return "kryptos:" + B64.encode(JSON.stringify(this.toJWK("private")), "b64u");
  }

  public toJSON(): KryptosJSON {
    return removeUndefined<KryptosJSON>({
      id: this.id,
      algorithm: this.algorithm,
      certificateChain: this.certificateChain,
      certificateThumbprint: this.certificateThumbprint,
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
      use: this.use,
    });
  }

  public toJWK(mode: KryptosExportMode = "public"): LindormJwk {
    this.assertNotDisposed();

    const cacheKey = mode === "private" ? "jwkPrivate" : "jwkPublic";
    if (!this._cache[cacheKey]) {
      const { kid, alg, kty, use, ...keys } = exportToJwk({
        id: this.id,
        algorithm: this.algorithm,
        curve: this.curve ?? undefined,
        mode: mode,
        privateKey: this._privateKey,
        publicKey: this._publicKey,
        type: this.type,
        use: this.use,
      });
      this._cache[cacheKey] = Object.freeze(keys);
    }

    return removeEmpty({
      ...this._cache[cacheKey],
      kid: this.id,
      alg: this.algorithm,
      use: this.use,
      kty: this.type,
      enc: this.encryption ?? undefined,
      exp: getUnixTime(this.expiresAt),
      iat: getUnixTime(this.createdAt),
      iss: this.issuer ?? undefined,
      jku: this.jwksUri ?? undefined,
      key_ops: this.operations,
      nbf: getUnixTime(this.notBefore),
      owner_id: this.ownerId ?? undefined,
      purpose: this.purpose ?? undefined,
      x5c: this.certificateChain.length > 0 ? this.certificateChain : undefined,
      "x5t#S256": this.certificateThumbprint ?? undefined,
    });
  }

  public toString(): string {
    return `Kryptos<${this._type}:${this._algorithm}:${this._id}>`;
  }

  // private methods

  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new KryptosError("Key has been disposed");
    }
  }

  private generateKeys(options: KryptosOptions): KryptosKeys {
    const keys = createDerFromDer(options as KryptosBuffer);

    if (isOctDer(keys)) {
      return { privateKey: keys.privateKey };
    } else {
      return { privateKey: keys.privateKey, publicKey: keys.publicKey };
    }
  }
}
