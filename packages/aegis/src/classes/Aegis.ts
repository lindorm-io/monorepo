import {
  type AesContent,
  type AesDecryptionRecord,
  type AesEncryptionRecord,
  AesKit,
  type SerialisedAesDecryption,
  type SerialisedAesEncryption,
} from "@lindorm/aes";
import type { AmphoraPredicate, IAmphora } from "@lindorm/amphora";
import type {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { AegisError } from "../errors/index.js";
import type {
  IAegis,
  IAegisAes,
  IAegisJwe,
  IAegisJws,
  IAegisJwt,
} from "../interfaces/index.js";
import type {
  AegisIntrospection,
  AegisOptions,
  AegisPredicate,
  AegisUserinfo,
  CertBindingMode,
  DecodedJwe,
  DecodedJws,
  DecodedJwt,
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
  TokenHeaderClaims,
  ValidateJwtOptions,
  VerifyJwtOptions,
} from "../types/index.js";
import { createJwtValidate } from "../internal/utils/jwt-validate.js";
import { validate as validateClaims } from "../internal/utils/validate.js";
import { decodeJoseHeader } from "../internal/utils/jose-header.js";
import {
  type IntrospectClaimsInput,
  parseIntrospection,
} from "../internal/utils/parse-introspection.js";
import {
  parseUserinfo,
  type UserinfoClaimsInput,
} from "../internal/utils/parse-userinfo.js";
import { JweKit } from "./JweKit.js";
import { JwsKit } from "./JwsKit.js";
import { JwtKit } from "./JwtKit.js";

type PredicateOptions = {
  predicate?: AegisPredicate;
};

type EncOptions = PredicateOptions & {
  id?: string;
  algorithm?: KryptosEncAlgorithm;
  encrypt?: boolean;
};

type SigOptions = PredicateOptions & {
  id?: string;
  algorithm?: KryptosSigAlgorithm;
  sign?: boolean;
};

export class Aegis implements IAegis {
  public readonly issuer: string | null;

  private readonly amphora: IAmphora;
  private readonly certBindingMode: CertBindingMode;
  private readonly clockTolerance: number;
  private readonly dpopMaxSkew: number | undefined;
  private readonly encAlgorithm: KryptosEncAlgorithm | undefined;
  private readonly encryption: KryptosEncryption;
  private readonly logger: ILogger;
  private readonly sigAlgorithm: KryptosSigAlgorithm | undefined;

  public constructor(options: AegisOptions) {
    this.logger = options.logger.child(["AegisKit"]);
    this.amphora = options.amphora;
    this.issuer = options.issuer ?? this.amphora.domain;

    this.certBindingMode = options.certBindingMode ?? "strict";
    this.clockTolerance = options.clockTolerance ?? 0;
    this.dpopMaxSkew = options.dpopMaxSkew;
    this.encAlgorithm = options.encAlgorithm;
    this.encryption = options.encryption ?? "A256GCM";
    this.sigAlgorithm = options.sigAlgorithm;
  }

  public get aes(): IAegisAes {
    return {
      encrypt: this.aesEncrypt.bind(this) as IAegisAes["encrypt"],
      decrypt: this.aesDecrypt.bind(this),
    };
  }

  public get jwe(): IAegisJwe {
    return {
      encrypt: this.jweEncrypt.bind(this),
      decrypt: this.jweDecrypt.bind(this),
    };
  }

  public get jws(): IAegisJws {
    return {
      sign: this.jwsSign.bind(this),
      verify: this.jwsVerify.bind(this),
    };
  }

  public get jwt(): IAegisJwt {
    return {
      sign: this.jwtSign.bind(this),
      verify: this.jwtVerify.bind(this),
    };
  }

  public async verify<T extends ParsedJwt | ParsedJws<any>>(
    token: string,
    options?: VerifyJwtOptions,
  ): Promise<T> {
    if (Aegis.isJwt(token)) {
      return (await this.jwtVerify(token, options)) as T;
    }
    if (Aegis.isJwe(token)) {
      const decrypt = await this.jweDecrypt(token);
      return await this.verify(decrypt.payload);
    }
    if (Aegis.isJws(token)) {
      return (await this.jwsVerify(token)) as T;
    }
    throw new AegisError("Invalid token type", { debug: { token } });
  }

  // public static

  public static header(token: string): TokenHeaderClaims {
    const [header] = token.split(".");
    return decodeJoseHeader(header);
  }

  public static isJwe(jwe: string): boolean {
    return JweKit.isJwe(jwe);
  }

  public static isJws(jws: string): boolean {
    return JwsKit.isJws(jws);
  }

  public static isJwt(jwt: string): boolean {
    return JwtKit.isJwt(jwt);
  }

  public static decode<T extends DecodedJwe | DecodedJws | DecodedJwt>(token: string): T {
    if (Aegis.isJwe(token)) {
      return JweKit.decode(token) as T;
    }
    if (Aegis.isJws(token)) {
      return JwsKit.decode(token) as T;
    }
    if (Aegis.isJwt(token)) {
      return JwtKit.decode(token) as T;
    }
    throw new AegisError("Invalid token type", { debug: { token } });
  }

  public static parse<T extends ParsedJwt | ParsedJws<any>>(token: string): T {
    if (Aegis.isJwt(token)) {
      return JwtKit.parse(token) as T;
    }
    if (Aegis.isJws(token)) {
      return JwsKit.parse(token) as T;
    }
    throw new AegisError("Invalid token type", { debug: { token } });
  }

  public static parseUserinfo(data: UserinfoClaimsInput): AegisUserinfo {
    return parseUserinfo(data);
  }

  public static parseIntrospection(data: IntrospectClaimsInput): AegisIntrospection {
    return parseIntrospection(data);
  }

  /**
   * Validate a flat claim dict against a JwtClaimMatchers-style declarative
   * matcher. Throws LindormError("Invalid token") with details about every
   * failing key when the claims don't match.
   *
   * Works on any flat claim source — ParsedJwtPayload, AegisIntrospection,
   * AegisUserinfo, or any structurally-compatible dict.
   */
  public static validateClaims(claims: Dict, matchers: ValidateJwtOptions): void {
    const predicate = createJwtValidate(matchers);
    validateClaims(claims, predicate);
  }

  // private aes

  private async aesKit(options: EncOptions = {}): Promise<AesKit> {
    const kryptos = await this.kryptosEnc(options);

    return new AesKit({ encryption: this.encryption, kryptos });
  }

  private async aesEncrypt(
    data: AesContent,
    mode: "encoded" | "record" | "serialised" | "tokenised" = "encoded",
  ): Promise<string | AesEncryptionRecord | SerialisedAesEncryption> {
    const kit = await this.aesKit({ encrypt: true });

    return kit.encrypt(data, mode as "encoded");
  }

  private async aesDecrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): Promise<T> {
    const parsed = AesKit.parse(data);

    const kit = await this.aesKit({
      id: parsed.keyId,
      algorithm: parsed.algorithm as KryptosEncAlgorithm | undefined,
    });

    return kit.decrypt<T>(data);
  }

  // private jwe

  private async jweKit(options: EncOptions = {}): Promise<JweKit> {
    const kryptos = await this.kryptosEnc(options);

    return new JweKit({
      certBindingMode: this.certBindingMode,
      encryption: this.encryption,
      kryptos,
      logger: this.logger,
    });
  }

  private async jweEncrypt(
    data: string,
    options: JweEncryptOptions & PredicateOptions = {},
  ): Promise<EncryptedJwe> {
    const kit = await this.jweKit({ encrypt: true });

    return kit.encrypt(data, options);
  }

  private async jweDecrypt(jwe: string): Promise<DecryptedJwe> {
    const decode = JweKit.decode(jwe);

    const kit = await this.jweKit({
      id: decode.header.kid,
      algorithm: decode.header.alg as KryptosEncAlgorithm,
    });

    return kit.decrypt(jwe);
  }

  // private jws

  private async jwsKit(options: SigOptions = {}): Promise<JwsKit> {
    const kryptos = await this.kryptosSig(options);

    return new JwsKit({
      certBindingMode: this.certBindingMode,
      kryptos,
      logger: this.logger,
    });
  }

  private async jwsSign<T extends JwsContent>(
    data: T,
    options: SignJwsOptions & PredicateOptions = {},
  ): Promise<SignedJws> {
    const kit = await this.jwsKit({ sign: true });

    return kit.sign(data, options);
  }

  private async jwsVerify<T extends JwsContent>(jws: string): Promise<ParsedJws<T>> {
    const decode = JwsKit.decode(jws);

    const kit = await this.jwsKit({
      id: decode.header.kid,
      algorithm: decode.header.alg as KryptosSigAlgorithm,
    });

    return kit.verify(jws);
  }

  // private jwt

  private async jwtKit(options: SigOptions = {}): Promise<JwtKit> {
    const kryptos = await this.kryptosSig(options);

    return new JwtKit({
      certBindingMode: this.certBindingMode,
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew,
      issuer: this.issuer ?? undefined,
      kryptos,
      logger: this.logger,
    });
  }

  private async jwtSign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options: SignJwtOptions & PredicateOptions = {},
  ): Promise<SignedJwt> {
    const kit = await this.jwtKit({ sign: true });

    return kit.sign(content, options);
  }

  private async jwtVerify<T extends Dict = Dict>(
    jwt: string,
    verify: VerifyJwtOptions = {},
  ): Promise<ParsedJwt<T>> {
    const decode = JwtKit.decode(jwt);

    const kit = await this.jwtKit({
      id: decode.header.kid,
      algorithm: decode.header.alg as KryptosSigAlgorithm,
    });

    return kit.verify(jwt, verify);
  }

  // private kryptos

  private async kryptosEnc(options: EncOptions = {}): Promise<IKryptos> {
    const query: AmphoraPredicate = options.encrypt
      ? {
          $or: [
            { operations: ["encrypt"] },
            { operations: ["deriveKey"] },
            { operations: ["wrapKey"] },
          ],
          algorithm: this.encAlgorithm,
          issuer: this.issuer ?? undefined,
          ...(options.predicate ?? {}),
        }
      : {
          $or: [
            { operations: ["decrypt"] },
            { operations: ["deriveKey"] },
            { operations: ["unwrapKey"] },
          ],
          algorithm: options.algorithm ?? this.encAlgorithm,
          ...(options.predicate ?? {}),
        };

    const kryptos = options.id
      ? await this.amphora.findById(options.id)
      : await this.amphora.find({ ...query, use: "enc" });

    this.logger.debug("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }

  private async kryptosSig(options: SigOptions = {}): Promise<IKryptos> {
    // SECURITY INVARIANT: verification keys are ALWAYS sourced from Amphora.
    // The JOSE header parameters `jku`, `jwk`, `x5u`, `x5c`, `x5t`, and
    // `x5t#S256` are never trusted as key sources during verification, even
    // if present in the token header. This closes the "header-embedded key"
    // attack class (CVE-class vulnerabilities that have hit multiple other
    // JOSE libraries where the verifier naively used the header-supplied
    // key to validate the signature).
    //
    // The only input the verifier accepts from the header is `kid`, which
    // is used as a lookup key into Amphora — never as a key itself.
    const query: AmphoraPredicate = options.sign
      ? {
          algorithm: this.sigAlgorithm,
          issuer: this.issuer ?? undefined,
          operations: ["sign"],
          ...(options.predicate ?? {}),
        }
      : {
          algorithm: options.algorithm ?? this.sigAlgorithm,
          operations: ["verify"],
          ...(options.predicate ?? {}),
        };

    const kryptos = options.id
      ? await this.amphora.findById(options.id)
      : await this.amphora.find({ ...query, use: "sig" });

    this.logger.debug("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }
}
