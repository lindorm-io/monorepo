import { IAmphora } from "@lindorm/amphora";
import {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosOperation,
  KryptosSigAlgorithm,
} from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import {
  AegisOptions,
  DecryptedJwe,
  EncryptedJwe,
  IAegis,
  IAegisJwe,
  IAegisJws,
  IAegisJwt,
  JweEncryptOptions,
  JwsContent,
  SignJwsOptions,
  SignJwtContent,
  SignJwtOptions,
  SignedJws,
  SignedJwt,
  VerifiedJws,
  VerifiedJwt,
  VerifyJwtOptions,
} from "../types";
import { JweKit } from "./JweKit";
import { JwsKit } from "./JwsKit";
import { JwtKit } from "./JwtKit";

export class Aegis implements IAegis {
  private readonly amphora: IAmphora;
  private readonly clockTolerance: number;
  private readonly encAlgorithm: KryptosEncAlgorithm | undefined;
  private readonly encryption: KryptosEncryption;
  private readonly issuer: string | undefined;
  private readonly kryptosMayOverrideEncryption: boolean;
  private readonly logger: ILogger;
  private readonly sigAlgorithm: KryptosSigAlgorithm | undefined;

  public constructor(options: AegisOptions) {
    this.logger = options.logger.child(["AegisKit"]);
    this.amphora = options.amphora;
    this.issuer = options.issuer;

    this.clockTolerance = options.clockTolerance ?? 0;
    this.encAlgorithm = options.encAlgorithm;
    this.encryption = options.encryption ?? "A256GCM";
    this.kryptosMayOverrideEncryption = options.kryptosMayOverrideEncryption ?? true;
    this.sigAlgorithm = options.sigAlgorithm;
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

  // private jwe

  private async jweKit(operation: KryptosOperation): Promise<JweKit> {
    const kryptos = await this.kryptosEnc(operation);

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
    const jweKit = await this.jweKit("encrypt");
    return jweKit.encrypt(data, options);
  }

  private async jweDecrypt(jwe: string): Promise<DecryptedJwe> {
    const jweKit = await this.jweKit("decrypt");
    return jweKit.decrypt(jwe);
  }

  // private jws

  private async jwsKit(operation: KryptosOperation): Promise<JwsKit> {
    const kryptos = await this.kryptosSig(operation);

    return new JwsKit({ kryptos, logger: this.logger });
  }

  private async jwsSign<T extends JwsContent>(
    data: T,
    options?: SignJwsOptions,
  ): Promise<SignedJws> {
    const jwsKit = await this.jwsKit("sign");
    return jwsKit.sign(data, options);
  }

  private async jwsVerify<T extends JwsContent>(jws: string): Promise<VerifiedJws<T>> {
    const jwsKit = await this.jwsKit("verify");
    return jwsKit.verify(jws);
  }

  // private jwt

  private async jwtKit(operation: KryptosOperation): Promise<JwtKit> {
    const kryptos = await this.kryptosSig(operation);

    return new JwtKit({
      clockTolerance: this.clockTolerance,
      issuer: this.issuer,
      kryptos,
      logger: this.logger,
    });
  }

  private async jwtSign<T extends Dict = Dict>(
    content: SignJwtContent<T>,
    options?: SignJwtOptions,
  ): Promise<SignedJwt> {
    const jwtKit = await this.jwtKit("sign");
    return jwtKit.sign(content, options);
  }

  private async jwtVerify<T extends Dict = Dict>(
    jwt: string,
    verify?: VerifyJwtOptions,
  ): Promise<VerifiedJwt<T>> {
    const jwtKit = await this.jwtKit("verify");
    return jwtKit.verify(jwt, verify);
  }

  // private kryptos

  private async kryptosEnc(operation: KryptosOperation): Promise<IKryptos> {
    const kryptos = await this.amphora.find({
      algorithm: this.encAlgorithm,
      issuer: this.issuer,
      operation,
      use: "enc",
    });

    this.logger.silly("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }

  private async kryptosSig(operation: KryptosOperation): Promise<IKryptos> {
    const kryptos = await this.amphora.find({
      algorithm: this.sigAlgorithm,
      issuer: this.issuer,
      operation,
      private: true,
      use: "sig",
    });

    this.logger.silly("Kryptos found", { kryptos: kryptos.toJSON() });

    return kryptos;
  }
}
