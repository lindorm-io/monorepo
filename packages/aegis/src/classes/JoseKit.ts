import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import {
  computeTypHeader,
  extractTypPrefix,
} from "../internal/utils/compute-typ-header.js";
import {
  assembleJwtWireClaims,
  buildSignedJwt,
  withSensitiveIdentity,
} from "../internal/utils/jwt-payload.js";
import { verifyJwtToDomain } from "../internal/utils/verify-jwt.js";
import type {
  CertificateBindingMode,
  DecryptedJwe,
  EncryptedJwe,
  JweEncryptOptions,
  JwsContent,
  ParsedJws,
  ParsedJwt,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedJws,
  SignedJwt,
  VerifyJwtOptions,
} from "../types/index.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

const DEFAULT_DPOP_MAX_SKEW = 60;

export type JoseKitSettings = {
  certBindingMode: CertificateBindingMode;
  clockTolerance: number;
  dpopMaxSkew: number | undefined;
  encryption: KryptosEncryption;
  logger: ILogger;
};

/**
 * The JOSE format facade — the JOSE analogue of CoseKit. Aegis resolves the
 * key (kryptosSig / kryptosEnc against amphora) and hands it in as the first
 * param of each operation; JoseKit holds only the JOSE config + logger and
 * constructs the inner wire kits (JwsKit / JweKit / JwtKit) per call, so Aegis
 * itself never constructs the JOSE wire kits.
 */
export class JoseKit {
  private readonly certBindingMode: CertificateBindingMode;
  private readonly clockTolerance: number;
  private readonly dpopMaxSkew: number | undefined;
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;

  constructor(options: JoseKitSettings) {
    this.certBindingMode = options.certBindingMode;
    this.clockTolerance = options.clockTolerance;
    this.dpopMaxSkew = options.dpopMaxSkew;
    this.encryption = options.encryption;
    this.logger = options.logger;
  }

  signJws<T extends JwsContent>(
    kryptos: IKryptos,
    data: T,
    options: SignJwsOptions = {},
  ): SignedJws {
    return this.jws(kryptos).sign(data, options);
  }

  verifyJws<T extends JwsContent>(kryptos: IKryptos, jws: string): ParsedJws<T> {
    return this.jws(kryptos).verify(jws);
  }

  /**
   * `encryption` overrides the configured content-encryption AEAD for this call
   * — the caller's `AegisEncKey.encryption`. It picks the cipher, never the key.
   */
  encryptJwe(
    kryptos: IKryptos,
    data: string,
    options: JweEncryptOptions = {},
    encryption?: KryptosEncryption,
  ): EncryptedJwe {
    return this.jwe(kryptos, encryption).encrypt(data, options);
  }

  decryptJwe(kryptos: IKryptos, jwe: string): DecryptedJwe {
    return this.jwe(kryptos).decrypt(jwe);
  }

  /**
   * The raw `aegis.jwt.sign` path: translate the DOMAIN content to the JOSE wire
   * dict Aegis-side (R18), then hand the fully-cased dict to the TRANSFORM-FREE
   * kit. An explicit `options.typ` wins; otherwise the typ is derived from the
   * domain `tokenType`.
   */
  signJwt<T extends Dict = Dict>(
    kryptos: IKryptos,
    content: SignJwtContent<T>,
    options: SignJwtOptions = {},
  ): SignedJwt {
    const claims = assembleJwtWireClaims<T>(
      { algorithm: kryptos.algorithm },
      content,
      options,
    );

    // The domain full typ (explicit / tokenType-derived), reduced to the bare
    // prefix the wire kit re-wraps into `application/<prefix>+jwt`.
    const fullTyp =
      options.typ != null ? options.typ : computeTypHeader(content.tokenType, "jwt");

    const token = this.jwt(kryptos).sign(claims, {
      bindCertificate: options.bindCertificate,
      header: options.header,
      objectId: options.objectId,
      omit: options.omit,
      typ: extractTypPrefix(fullTyp),
    });

    return buildSignedJwt(token, claims, options.objectId);
  }

  verifyJwt<T extends Dict = Dict>(
    kryptos: IKryptos,
    jwt: string,
    options: VerifyJwtOptions = {},
  ): ParsedJwt<T> {
    return verifyJwtToDomain<T>(this.jwt(kryptos), jwt, options, {
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew ?? DEFAULT_DPOP_MAX_SKEW,
    });
  }

  /**
   * The profiled `mint` path: `claims` are ALREADY the translated JOSE wire dict
   * (Aegis assembled + validated them); only the sensitive-identity envelope is
   * spread here before the transform-free kit serializes. The typ is the
   * profile's mandated value, or the tokenType-derived default.
   */
  signClaims<C extends Dict = Dict>(
    kryptos: IKryptos,
    claims: Dict,
    content: SignJwtContent<C>,
    options: SignJwtOptions = {},
  ): SignedJwt {
    const wireClaims = withSensitiveIdentity(claims, content);

    const fullTyp =
      options.typ != null ? options.typ : computeTypHeader(content.tokenType, "jwt");

    const token = this.jwt(kryptos).sign(wireClaims, {
      bindCertificate: options.bindCertificate,
      header: options.header,
      objectId: options.objectId,
      omit: options.omit,
      typ: extractTypPrefix(fullTyp),
    });

    return buildSignedJwt(token, wireClaims, options.objectId);
  }

  // private

  private jws(kryptos: IKryptos): JwsKit {
    return new JwsKit({
      certBindingMode: this.certBindingMode,
      kryptos,
      logger: this.logger,
    });
  }

  private jwe(kryptos: IKryptos, encryption?: KryptosEncryption): JweKit {
    return new JweKit({
      certBindingMode: this.certBindingMode,
      encryption: encryption ?? this.encryption,
      kryptos,
      logger: this.logger,
    });
  }

  private jwt(kryptos: IKryptos): JwtKit {
    return new JwtKit({
      certBindingMode: this.certBindingMode,
      clockTolerance: this.clockTolerance,
      kryptos,
      logger: this.logger,
    });
  }
}
