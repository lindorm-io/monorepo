import { B64 } from "@lindorm/b64";
import {
  expiresAt,
  getUnixTime,
  isAfter,
  isAfterOrEqual,
  isExpired as isDateExpired,
  isLive,
} from "@lindorm/date";
import { isBuffer, isInteger } from "@lindorm/is";
import { lindormId } from "@lindorm/random";
import { omitEmpty, omitUndefined } from "@lindorm/utils";
import { KryptosError } from "../errors/index.js";
import type { IKryptos } from "../interfaces/index.js";
import { KRYPTOS_BRAND } from "../internal/constants/brand.js";
import type { CachedCertificate, ExportCache } from "../internal/types/export-cache.js";
import { calculateAlgClass } from "../internal/utils/alg-class.js";
import { encodeCborEnv } from "../internal/utils/cbor/encode-cbor-env.js";
import { computeKeyId } from "../internal/utils/compute-key-id.js";
import { computeThumbprint } from "../internal/utils/compute-thumbprint.js";
import { exportToB64 } from "../internal/utils/export/export-b64.js";
import { exportToDer } from "../internal/utils/export/export-der.js";
import { exportToJwk } from "../internal/utils/export/export-jwk.js";
import { exportToPem } from "../internal/utils/export/export-pem.js";
import { createDerFromDer } from "../internal/utils/from/der-from-der.js";
import { calculateKeyOps } from "../internal/utils/key-ops.js";
import { isOctDer } from "../internal/utils/oct/is.js";
import { modulusSize } from "../internal/utils/rsa/modulus-size.js";
import { certDerToPem } from "../internal/utils/x509/der-to-pem.js";
import { extractLeafSpki } from "../internal/utils/x509/extract-leaf-spki.js";
import { parseX509Certificate } from "../internal/utils/x509/parse-certificate.js";
import { parseX509 } from "../internal/utils/x509/parse-x509.js";
import { verifyX509Chain } from "../internal/utils/x509/verify-chain.js";
import { x509PublicKeyMatches } from "../internal/utils/x509/x509-public-key-matches.js";
import {
  x5tS1 as x5tS1Thumbprint,
  x5tS256 as x5tS256Thumbprint,
} from "../internal/utils/x509/x509-thumbprints.js";
import type {
  KryptosAlgClass,
  KryptosAlgorithm,
  KryptosBuffer,
  KryptosCertificate,
  KryptosCertificateB64,
  KryptosCertificateDer,
  KryptosCertificateFormat,
  KryptosCertificateJwk,
  KryptosCertificatePem,
  KryptosCurve,
  KryptosDB,
  KryptosEncryption,
  KryptosEnvFormat,
  KryptosExportMode,
  KryptosFormat,
  KryptosJSON,
  KryptosJwk,
  KryptosKey,
  KryptosKeys,
  KryptosOperation,
  KryptosPem,
  KryptosSettings,
  KryptosString,
  KryptosType,
  KryptosUse,
  LindormJwk,
  ParsedX509Certificate,
  RsaModulus,
} from "../types/index.js";

export class Kryptos implements IKryptos {
  private readonly _id: string;
  private readonly _algorithm: KryptosAlgorithm;
  private readonly _createdAt: Date;
  private readonly _curve: KryptosCurve | null;
  private readonly _internal: boolean;
  private readonly _modulus: RsaModulus | null;
  private readonly _privateKey: Buffer | undefined;
  private readonly _publicKey: Buffer | undefined;
  private readonly _type: KryptosType;
  private readonly _use: KryptosUse;
  private readonly _certificateChain: ReadonlyArray<Buffer> | undefined;
  private readonly _encryption: KryptosEncryption | null;
  private readonly _expiresAt: Date;
  private readonly _issuer: string | null;
  private readonly _jwksUri: string | null;
  private readonly _notBefore: Date;
  private readonly _ownerId: string | null;
  private readonly _publish: boolean;
  private readonly _purpose: string | null;

  private _cache: ExportCache = {};
  private _disposed: boolean = false;

  constructor(options: KryptosSettings) {
    this._algorithm = options.algorithm;
    this._createdAt = options.createdAt ?? new Date();
    this._curve = options.curve || null;
    this._encryption = options.encryption || null;
    this._notBefore = options.notBefore ?? new Date();
    this._expiresAt = options.expiresAt ?? expiresAt("25 years", this._notBefore);
    // Defaults to TRUE: a key we MINT, DERIVE or import from our OWN env is ours.
    // Provenance only goes FALSE for key material someone handed us — in practice
    // a remote JWKS, which `from.jwk` marks by defaulting the flag to FALSE.
    //
    // ⚠ It is never read off a payload. `parseJwkOptions` hardcodes it rather than
    // trusting the JWK, so a remote JWKS cannot plant `internal: true` and pass
    // itself off as one of our keys. Provenance is a property of HOW the key got
    // here, and only the import path knows that.
    this._internal = options.internal ?? true;
    this._issuer = options.issuer || null;
    this._jwksUri = options.jwksUri || null;
    this._ownerId = options.ownerId || null;
    // Defaults to FALSE: a key we MINT is unpublished until we say otherwise.
    // The harms are asymmetric — accidentally publishing a key that should have
    // stayed internal (a KEK, a root CA, a cookie key) is a SILENT exposure, while
    // accidentally withholding a key that should be public fails LOUDLY and at
    // once (RPs cannot verify, and you know within seconds). So publication is an
    // outward-facing act you opt INTO. The flag is never inferred either —
    // `purpose` is a free-form string owned by the consumer, so kryptos does not
    // guess publication policy from it.
    this._publish = options.publish ?? false;
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
        {
          code: "missing_key_material",
          title: "Missing Key Material",
          details:
            "A Kryptos instance must be initialised with a private key, a public key, or both.",
        },
      );
    }

    // Resolved after key material is set: an explicit id always wins; otherwise
    // asymmetric keys get a deterministic thumbprint id, oct keys a random one.
    this._id = options.id || this.resolveId();

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
          {
            code: "missing_public_key",
            title: "Missing Public Key",
            details:
              "A certificate chain requires a Kryptos with a public key; symmetric (oct) keys are not supported.",
          },
        );
      }

      const ders = parseX509(options.certificateChain!);
      const leafSpki = extractLeafSpki(ders[0]);

      if (!x509PublicKeyMatches(leafSpki, this._publicKey, this._type)) {
        throw new KryptosError(
          "certificateChain leaf certificate public key does not match kryptos public key",
          {
            code: "certificate_public_key_mismatch",
            title: "Certificate Public Key Mismatch",
            details:
              "The leaf certificate's public key in the certificate chain does not match the Kryptos public key.",
          },
        );
      }

      this._certificateChain = ders;
    }
  }

  // getters and setters

  get id(): string {
    return this._id;
  }

  get algorithm(): KryptosAlgorithm {
    return this._algorithm;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get curve(): KryptosCurve | null {
    return this._curve;
  }

  get encryption(): KryptosEncryption | null {
    return this._encryption;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  /**
   * Is this OUR key material? True for anything we minted, derived or loaded from
   * our own env; false only for key material a third party handed us (a remote
   * JWKS). Decided by the import path, never by the payload — see `parseJwkOptions`.
   */
  get internal(): boolean {
    return this._internal;
  }

  get issuer(): string | null {
    return this._issuer;
  }

  get jwksUri(): string | null {
    return this._jwksUri;
  }

  get notBefore(): Date {
    return this._notBefore;
  }

  get ownerId(): string | null {
    return this._ownerId;
  }

  /**
   * Does this key belong in the published JWKS? Consumers (amphora) filter on it
   * for BOTH publication and selection, so it means what it says — unlike the
   * `hidden` flag it replaces, which was only ever consulted when building the
   * JWKS while the key stayed selectable for any operation.
   */
  get publish(): boolean {
    return this._publish;
  }

  get purpose(): string | null {
    return this._purpose;
  }

  get type(): KryptosType {
    return this._type;
  }

  get use(): KryptosUse {
    return this._use;
  }

  // metadata

  /**
   * Asymmetric or symmetric key material, derived from `type` (`oct` ⇔ symmetric).
   * Never stored and never on the wire — a derived fact, like `operations`.
   *
   * NOT redundant with `type: { $nin: ["oct"] }`. `KryptosType` is `"AKP" | "EC" |
   * "oct" | "OKP" | "RSA"` and it grows — AKP arrived with post-quantum. Every
   * consumer that hand-writes that `$nin` list rots silently the day a sixth type
   * lands, which is the same "every consumer re-derives the rule" pattern that
   * produced the hidden cookie-key bug. The rule is defined ONCE, here, on the
   * key, so it cannot drift; and `calculateAlgClass` throws on an unclassified
   * type rather than guessing.
   */
  get algClass(): KryptosAlgClass {
    return calculateAlgClass(this._type);
  }

  get expiresIn(): number {
    if (this.isExpired) return 0;
    return getUnixTime(this._expiresAt) - getUnixTime(new Date());
  }

  get hasPrivateKey(): boolean {
    return isBuffer(this._privateKey) && this._privateKey.length > 0;
  }

  get hasPublicKey(): boolean {
    return isBuffer(this._publicKey) && this._publicKey.length > 0;
  }

  // A key's lifetime has THREE states, and they are mutually exclusive and
  // exhaustive: pending → active → expired. Naming all three is what lets a
  // consumer state a time policy as a predicate, and therefore enforce it on a
  // key it was HANDED as well as one it queried — the vault filters `isActive`,
  // but an injected key never touches the vault.
  //
  //   sign / encrypt   `isActive: true`    the key must be usable NOW
  //   verify / decrypt `isPending: false`  the key must have been usable at SOME
  //                                        point. An expired key MUST still
  //                                        verify what it signed while valid;
  //                                        a key whose notBefore has not passed
  //                                        cannot have signed anything, ever.

  get isPending(): boolean {
    return isAfter(this._notBefore, new Date());
  }

  // One clock read for the whole window: `isPending` and `isExpired` each sample
  // their own `new Date()`, so composing them would compare the two ends of the
  // window against two different instants.
  get isActive(): boolean {
    const now = new Date();
    return isAfterOrEqual(now, this._notBefore) && isLive(this._expiresAt, now);
  }

  get isExpired(): boolean {
    return isDateExpired(this._expiresAt);
  }

  get modulus(): RsaModulus | null {
    return this._modulus;
  }

  /**
   * What this key MATERIAL can do — NOT JOSE `key_ops`, and NOT WebCrypto usages.
   * A private JWK embeds the public half, so a full keypair reports [sign, verify];
   * WebCrypto would say [sign], because it models ONE CryptoKey with ONE type.
   * Never emitted on the wire — `toJWK` omits key_ops in BOTH modes.
   */
  get operations(): Array<KryptosOperation> {
    return calculateKeyOps({
      algorithm: this._algorithm,
      hasPrivateKey: this.hasPrivateKey,
      use: this._use,
    });
  }

  get thumbprint(): string {
    this.assertNotDisposed();
    return computeThumbprint(this.export("jwk"));
  }

  // x509

  get hasCertificate(): boolean {
    return this._certificateChain !== undefined && this._certificateChain.length > 0;
  }

  /**
   * The leaf's SHA-256 thumbprint, or `null` when this key carries no
   * certificate. A lookup KEY rather than certificate material: a vault query
   * reads it off an instance, beside `id` and `algorithm`. The material — the
   * chain, and the digests in the formats that carry them — is reached through
   * `certificate(format)`, which spells this same value out of the same
   * memoized source.
   */
  get certificateThumbprint(): string | null {
    return this.certificateSource()?.thumbprint ?? null;
  }

  /**
   * The X.509 chain in the requested encoding, leaf first, or `null` when this
   * key carries no certificate. The one axis is ENCODING: every format states
   * the chain, spelled for its own domain, and `"b64"`/`"der"`/`"jwk"` state
   * both leaf digests beside it. `"pem"` carries the chain alone — a digest has
   * no PEM spelling.
   *
   * ⚠ `"b64"` is MIXED on purpose — RFC 7515 §4.1.6 defines an `x5c` entry as
   * standard base64 while RFC 7517 §4.8/§4.9 define the digests as base64url.
   */
  certificate(format: "b64"): KryptosCertificateB64 | null;
  certificate(format: "der"): KryptosCertificateDer | null;
  certificate(format: "jwk"): KryptosCertificateJwk | null;
  certificate(format: "pem"): KryptosCertificatePem | null;
  certificate(format: KryptosCertificateFormat): KryptosCertificate | null {
    // `source` is null exactly when there is no chain, and `source && …` carries
    // that through each branch — so an unknown format still reaches the throw on
    // a chain-less key, rather than being answered as an absent certificate.
    const source = this.certificateSource();

    switch (format) {
      case "b64":
        return (
          source && {
            chain: [...source.chain],
            thumbprint: source.thumbprint,
            thumbprintSha1: source.thumbprintSha1,
          }
        );

      case "der":
        return (
          source && {
            chain: source.ders.map((der) => Buffer.from(der)),
            thumbprint: B64.toBuffer(source.thumbprint, "b64u"),
            thumbprintSha1: B64.toBuffer(source.thumbprintSha1, "b64u"),
          }
        );

      case "jwk":
        return (
          source && {
            x5c: [...source.chain],
            x5t: source.thumbprintSha1,
            "x5t#S256": source.thumbprint,
          }
        );

      case "pem":
        return source && { chain: source.chain.map(certDerToPem) };

      default:
        throw new KryptosError(`Invalid certificate format: ${format as string}`, {
          code: "unsupported_certificate_format",
          title: "Unsupported Certificate Format",
          details: `The certificate format "${format as string}" is not supported; use b64, der, jwk, or pem.`,
          data: { format },
        });
    }
  }

  /**
   * The parsed certificate at `index` in the chain — `0`, the default, is the
   * leaf — or `null` when this key carries no certificate or the index falls
   * outside the chain. Each index is parsed on first read and memoized.
   */
  parseCertificate(index: number = 0): ParsedX509Certificate | null {
    if (!this._certificateChain) return null;
    // `isInteger` also rejects NaN and Infinity. Without it `chain[1.5]` is
    // `undefined` and the parser throws a raw TypeError instead of answering
    // null, which is what this method promises for an index off the chain.
    if (!isInteger(index)) return null;
    if (index < 0 || index >= this._certificateChain.length) return null;

    if (!this._cache.parsedCertificates) this._cache.parsedCertificates = [];

    const cached = this._cache.parsedCertificates[index];
    if (cached) return cached;

    const parsed = parseX509Certificate(this._certificateChain[index]);
    this._cache.parsedCertificates[index] = parsed;

    return parsed;
  }

  verifyCertificate(options: { trustAnchors: string | Array<string> }): void {
    this.assertNotDisposed();

    if (!this._certificateChain) {
      throw new KryptosError("Kryptos has no certificate to verify", {
        code: "missing_certificate",
        title: "Missing Certificate",
        details: "This Kryptos has no certificate chain available to verify.",
      });
    }

    verifyX509Chain(this._certificateChain, options.trustAnchors);
  }

  // dispose

  dispose(): void {
    if (this._disposed) return;

    if (this._privateKey) this._privateKey.fill(0);
    if (this._publicKey) this._publicKey.fill(0);

    this._cache = {};
    this._disposed = true;
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  // public methods

  export<K extends KryptosString>(format: "b64"): K;
  export<K extends KryptosBuffer>(format: "der"): K;
  export<K extends KryptosJwk>(format: "jwk"): K;
  export(format: "pem"): KryptosPem;
  export(format: KryptosFormat): KryptosKey {
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
            omitUndefined({
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
        return omitUndefined({
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
            omitUndefined({
              privateKey: result.privateKey,
              publicKey: result.publicKey,
            }),
          );
        }

        const certificate = this.certificate("pem");
        const certificatePem = certificate
          ? { certificate: certificate.chain[0], certificateChain: certificate.chain }
          : {};

        return { ...metadata, ...this._cache.pem, ...certificatePem } as KryptosPem;
      }

      default:
        throw new KryptosError(`Invalid key format: ${format}`, {
          code: "unsupported_export_format",
          title: "Unsupported Export Format",
          details: `The export format "${format as string}" is not supported; use jwk, pem, der, or b64.`,
          data: { format },
        });
    }
  }

  // to types

  toDB(): KryptosDB {
    this.assertNotDisposed();

    const { privateKey, publicKey } = this.export("b64");
    return omitUndefined<KryptosDB>({
      id: this.id,
      algorithm: this.algorithm,
      certificateChain: this.certificate("b64")?.chain ?? [],
      createdAt: this.createdAt,
      curve: this.curve,
      encryption: this.encryption,
      expiresAt: this.expiresAt,
      internal: this.internal,
      issuer: this.issuer,
      jwksUri: this.jwksUri,
      notBefore: this.notBefore,
      ownerId: this.ownerId,
      publish: this.publish,
      purpose: this.purpose,
      type: this.type,
      use: this.use,
      privateKey,
      publicKey,
    });
  }

  toEnvString(format: KryptosEnvFormat = "cbor"): string {
    this.assertNotDisposed();

    const jwk = this.toJWK("private");

    switch (format) {
      case "cbor":
        return "kryptos:" + B64.encode(encodeCborEnv(jwk), "b64u");

      case "json":
        return "kryptos:" + B64.encode(JSON.stringify(jwk), "b64u");

      default:
        throw new KryptosError(`Unsupported env-string format: ${format as string}`, {
          code: "unsupported_env_format",
          title: "Unsupported Env Format",
          details: `The env-string format "${format as string}" is not supported; use "cbor" or "json".`,
          data: { format },
        });
    }
  }

  toJSON(): KryptosJSON {
    const certificate = this.certificate("b64");

    return omitUndefined<KryptosJSON>({
      id: this.id,
      algClass: this.algClass,
      algorithm: this.algorithm,
      certificateChain: certificate?.chain ?? [],
      certificateThumbprint: certificate?.thumbprint ?? null,
      createdAt: this.createdAt,
      curve: this.curve,
      encryption: this.encryption,
      expiresAt: this.expiresAt,
      expiresIn: this.expiresIn,
      hasCertificate: this.hasCertificate,
      hasPrivateKey: this.hasPrivateKey,
      hasPublicKey: this.hasPublicKey,
      isActive: this.isActive,
      isExpired: this.isExpired,
      isPending: this.isPending,
      internal: this.internal,
      issuer: this.issuer,
      jwksUri: this.jwksUri,
      modulus: this.modulus,
      notBefore: this.notBefore,
      operations: this.operations,
      ownerId: this.ownerId,
      publish: this.publish,
      purpose: this.purpose,
      thumbprint: this.thumbprint,
      type: this.type,
      use: this.use,
    });
  }

  toJWK(mode: KryptosExportMode = "public"): LindormJwk {
    this.assertNotDisposed();

    // A PUBLIC oct JWK is a contradiction, not merely an awkward export. An oct
    // key's material IS `k` — the secret itself — so the only two things this
    // could return are a JWK that PUBLISHES YOUR SECRET, or one that omits `k`
    // and therefore carries no key at all: RFC 7518 §6.4 makes `k` the member
    // that represents a symmetric key. There is no third answer, so asking is a
    // programming error.
    //
    // Nothing in the toolkit reaches this: amphora's JWKS filters
    // `hasPublicKey: true`, and an oct key has no public half. The guard is for
    // the direct caller — `export("jwk")` is unaffected, since it always exports
    // the private JWK, where `k` belongs.
    if (mode === "public" && this._type === "oct") {
      throw new KryptosError("A symmetric key has no public JWK", {
        code: "no_public_jwk",
        data: { kid: this._id, type: this._type },
        title: "No Public JWK",
        details:
          'An oct (symmetric) key\'s material is its secret, so it has no public JWK: emitting one would either publish the secret or omit the required `k` parameter. Export it with mode "private", or exclude symmetric keys from whatever expects a public JWK.',
      });
    }

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

    const certificate = this.certificate("jwk");

    return omitEmpty({
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
      // `key_ops` is NEVER emitted — in either mode. RFC 7517 §4.3 makes it
      // OPTIONAL and says it SHOULD NOT be paired with `use`, which every JWK we
      // emit already carries; and it has no readers — `operations` is a derived
      // capability of the key material, re-derived on import.
      nbf: getUnixTime(this.notBefore),
      owner_id: this.ownerId ?? undefined,
      // Emitted only in private JWKs (env strings, DB round-trips); a public JWK
      // feeds the published JWKS, where the flag is a tautology. Always an
      // explicit boolean — `false` survives omitEmpty, `undefined` is stripped.
      // Two bytes of CBOR buys an env string that states its own policy.
      publish: mode === "private" ? this.publish : undefined,
      purpose: this.purpose ?? undefined,
      x5c: certificate?.x5c,
      x5t: certificate?.x5t,
      "x5t#S256": certificate?.["x5t#S256"],
    });
  }

  toString(): string {
    return `Kryptos<${this._type}:${this._algorithm}:${this._id}>`;
  }

  // private methods

  // The chain's base64 spelling and both leaf digests, derived once per instance.
  // Every format, and every `to*`/`export` caller, reads this one record; the
  // arrays are copied on the way out so no caller can reach the cached one.
  private certificateSource(): CachedCertificate | null {
    if (!this._certificateChain || this._certificateChain.length === 0) return null;

    if (!this._cache.certificate) {
      const ders = this._certificateChain;

      this._cache.certificate = Object.freeze({
        ders,
        chain: Object.freeze(ders.map((der) => der.toString("base64"))),
        thumbprint: x5tS256Thumbprint(ders[0]),
        thumbprintSha1: x5tS1Thumbprint(ders[0]),
      });
    }

    return this._cache.certificate;
  }

  private assertNotDisposed(): void {
    if (this._disposed) {
      throw new KryptosError("Key has been disposed", {
        code: "key_disposed",
        title: "Key Disposed",
        details:
          "This Kryptos instance has been disposed and its key material is no longer available.",
      });
    }
  }

  private generateKeys(options: KryptosSettings): KryptosKeys {
    const keys = createDerFromDer(options as KryptosBuffer);

    if (isOctDer(keys)) {
      return { privateKey: keys.privateKey };
    } else {
      return { privateKey: keys.privateKey, publicKey: keys.publicKey };
    }
  }

  // Derive the id when none was supplied. `export("jwk")` yields the public
  // members needed for the thumbprint (public half is derived from the private
  // key when necessary); the canonicalization ignores `kid`, so it is safe to
  // call before `_id` is set.
  private resolveId(): string {
    switch (this._type) {
      case "oct":
        return lindormId({ namespace: "key", length: 16 });

      case "AKP":
      case "EC":
      case "OKP":
      case "RSA":
        return computeKeyId(this.export("jwk"));

      default:
        throw new KryptosError(
          `Cannot derive key id: unsupported key type "${this._type as string}"`,
          {
            code: "unsupported_key_type",
            title: "Unsupported Key Type",
            details: `The key type "${this._type as string}" is not supported for key id derivation.`,
            data: { type: this._type },
          },
        );
    }
  }
}

// Brand the class so `KryptosKit` can recognise instances by a global-registry
// symbol rather than `instanceof`, which breaks across duplicate installs. See
// KRYPTOS_BRAND for why this survives multiple copies of @lindorm/kryptos.
Object.defineProperty(Kryptos, KRYPTOS_BRAND, { value: true });
