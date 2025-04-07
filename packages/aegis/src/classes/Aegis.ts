import {
  AesDecryptionRecord,
  AesEncryptionRecord,
  AesKit,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "@lindorm/aes";
import { AmphoraQuery, IAmphora } from "@lindorm/amphora";
import {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { AegisError } from "../errors";
import { IAegis, IAegisAes, IAegisJwe, IAegisJws, IAegisJwt } from "../interfaces";
import {
  AegisOptions,
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
  TokenHeaderAlgorithm,
  TokenHeaderClaims,
  VerifyJwtOptions,
} from "../types";
import { decodeTokenHeader } from "../utils/private";
import { JweKit } from "./JweKit";
import { JwsKit } from "./JwsKit";
import { JwtKit } from "./JwtKit";

type EncOptions = {
  id?: string;
  algorithm?: TokenHeaderAlgorithm;
  encrypt?: boolean;
};

type SigOptions = {
  id?: string;
  algorithm?: TokenHeaderAlgorithm;
  sign?: boolean;
};

export class Aegis implements IAegis {
  public readonly issuer: string | null;

  private readonly amphora: IAmphora;
  private readonly clockTolerance: number;
  private readonly encAlgorithm: KryptosEncAlgorithm | undefined;
  private readonly encryption: KryptosEncryption;
  private readonly kryptosMayOverrideEncryption: boolean;
  private readonly logger: ILogger;
  private readonly sigAlgorithm: KryptosSigAlgorithm | undefined;

  public constructor(options: AegisOptions) {
    this.logger = options.logger.child(["AegisKit"]);
    this.amphora = options.amphora;
    this.issuer = options.issuer ?? this.amphora.issuer;

    this.clockTolerance = options.clockTolerance ?? 0;
    this.encAlgorithm = options.encAlgorithm;
    this.encryption = options.encryption ?? "A256GCM";
    this.kryptosMayOverrideEncryption = options.kryptosMayOverrideEncryption ?? true;
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
    if (Aegis.isJwe(token)) {
      const decrypt = await this.jweDecrypt(token);
      return (await this.verify(decrypt.payload)) as T;
    }
    if (Aegis.isJws(token)) {
      return (await this.jwsVerify(token)) as T;
    }
    if (Aegis.isJwt(token)) {
      return (await this.jwtVerify(token, options)) as T;
    }
    throw new AegisError("Invalid token type", { debug: { token } });
  }

  // public static

  public static header(token: string): TokenHeaderClaims {
    const [header] = token.split(".");
    return decodeTokenHeader(header);
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
    if (Aegis.isJws(token)) {
      return JwsKit.parse(token) as T;
    }
    if (Aegis.isJwt(token)) {
      return JwtKit.parse(token) as T;
    }
    throw new AegisError("Invalid token type", { debug: { token } });
  }

  // private aes

  private async aesKit(options: EncOptions = {}): Promise<AesKit> {
    const kryptos = await this.kryptosEnc(options);

    return new AesKit({ kryptos });
  }

  private async aesEncrypt(
    data: string,
    mode: "encoded" | "record" | "serialised" | "tokenised",
  ): Promise<string | AesEncryptionRecord | SerialisedAesEncryption> {
    const kit = await this.aesKit({ encrypt: true });

    return kit.encrypt(data, mode as "encoded");
  }

  private async aesDecrypt(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): Promise<string> {
    const parsed = AesKit.parse(data);

    const kit = await this.aesKit({ id: parsed.keyId, algorithm: parsed.algorithm });

    return kit.decrypt(data);
  }

  // private jwe

  private async jweKit(options: EncOptions = {}): Promise<JweKit> {
    const kryptos = await this.kryptosEnc(options);

    return new JweKit({
      encryption: this.encryption,
      kryptos,
      kryptosMayOverrideEncryption: this.kryptosMayOverrideEncryption,
      logger: this.logger,
    });
  }

  private async jweEncrypt(
    data: string,
    options?: JweEncryptOptions,
  ): Promise<EncryptedJwe> {
    const kit = await this.jweKit({ encrypt: true });

    return kit.encrypt(data, options);
  }

  private async jweDecrypt(jwe: string): Promise<DecryptedJwe> {
    const decode = JweKit.decode(jwe);

    const kit = await this.jweKit({
      id: decode.header.kid,
      algorithm: decode.header.alg,
    });

    return kit.decrypt(jwe);
  }

  // private jws

  private async jwsKit(options: SigOptions = {}): Promise<JwsKit> {
    const kryptos = await this.kryptosSig(options);

    return new JwsKit({ kryptos, logger: this.logger });
  }

  private async jwsSign<T extends JwsContent>(
    data: T,
    options?: SignJwsOptions,
  ): Promise<SignedJws> {
    const kit = await this.jwsKit({ sign: true });

    return kit.sign(data, options);
  }

  private async jwsVerify<T extends JwsContent>(jws: string): Promise<ParsedJws<T>> {
    const decode = JwsKit.decode(jws);

    const kit = await this.jwsKit({
      id: decode.header.kid,
      algorithm: decode.header.alg,
    });

    return kit.verify(jws);
  }

  // private jwt

  private async jwtKit(options: SigOptions = {}): Promise<JwtKit> {
    const kryptos = await this.kryptosSig(options);

    return new JwtKit({
      clockTolerance: this.clockTolerance,
      issuer: this.issuer ?? undefined,
      kryptos,
      logger: this.logger,
    });
  }

  private async jwtSign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): Promise<SignedJwt> {
    const kit = await this.jwtKit({ sign: true });

    return kit.sign(content, options);
  }

  private async jwtVerify<T extends Dict = Dict>(
    jwt: string,
    verify?: VerifyJwtOptions,
  ): Promise<ParsedJwt<T>> {
    const decode = JwtKit.decode(jwt);

    const kit = await this.jwtKit({
      id: decode.header.kid,
      algorithm: decode.header.alg,
    });

    return kit.verify(jwt, verify);
  }

  // private kryptos

  private async kryptosEnc(options: EncOptions = {}): Promise<IKryptos> {
    const query: AmphoraQuery = options.encrypt
      ? {
          $or: [
            { operations: ["encrypt"] },
            { operations: ["deriveKey"] },
            { operations: ["wrapKey"] },
          ],
          algorithm: this.encAlgorithm,
          issuer: this.issuer ?? undefined,
        }
      : {
          $or: [
            { operations: ["decrypt"] },
            { operations: ["deriveKey"] },
            { operations: ["unwrapKey"] },
          ],
          algorithm: options.algorithm ?? this.encAlgorithm,
        };

    const kryptos = await this.amphora.find(
      options.id ? { id: options.id } : { ...query, use: "enc" },
    );

    this.logger.silly("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }

  private async kryptosSig(options: SigOptions = {}): Promise<IKryptos> {
    const query: AmphoraQuery = options.sign
      ? {
          algorithm: this.encAlgorithm,
          issuer: this.issuer ?? undefined,
          operations: ["sign"],
        }
      : {
          algorithm: options.algorithm ?? this.sigAlgorithm,
          operations: ["verify"],
        };

    const kryptos = await this.amphora.find(
      options.id ? { id: options.id } : { ...query, use: "sig" },
    );

    this.logger.silly("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }
}
