import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import type {
  CertBindingMode,
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

export type JoseKitOptions = {
  certBindingMode: CertBindingMode;
  clockTolerance: number;
  dpopMaxSkew: number | undefined;
  encryption: KryptosEncryption;
  issuer: string | undefined;
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
  private readonly certBindingMode: CertBindingMode;
  private readonly clockTolerance: number;
  private readonly dpopMaxSkew: number | undefined;
  private readonly encryption: KryptosEncryption;
  private readonly issuer: string | undefined;
  private readonly logger: ILogger;

  public constructor(options: JoseKitOptions) {
    this.certBindingMode = options.certBindingMode;
    this.clockTolerance = options.clockTolerance;
    this.dpopMaxSkew = options.dpopMaxSkew;
    this.encryption = options.encryption;
    this.issuer = options.issuer;
    this.logger = options.logger;
  }

  public signJws<T extends JwsContent>(
    kryptos: IKryptos,
    data: T,
    options: SignJwsOptions = {},
  ): SignedJws {
    return this.jws(kryptos).sign(data, options);
  }

  public verifyJws<T extends JwsContent>(kryptos: IKryptos, jws: string): ParsedJws<T> {
    return this.jws(kryptos).verify(jws);
  }

  public encryptJwe(
    kryptos: IKryptos,
    data: string,
    options: JweEncryptOptions = {},
  ): EncryptedJwe {
    return this.jwe(kryptos).encrypt(data, options);
  }

  public decryptJwe(kryptos: IKryptos, jwe: string): DecryptedJwe {
    return this.jwe(kryptos).decrypt(jwe);
  }

  public signJwt<T extends Dict = Dict>(
    kryptos: IKryptos,
    content: SignJwtContent<T>,
    options: SignJwtOptions = {},
  ): SignedJwt {
    return this.jwt(kryptos).sign(content, options);
  }

  public verifyJwt<T extends Dict = Dict>(
    kryptos: IKryptos,
    jwt: string,
    options: VerifyJwtOptions = {},
  ): ParsedJwt<T> {
    return this.jwt(kryptos).verify(jwt, options);
  }

  public signClaims<C extends Dict = Dict>(
    kryptos: IKryptos,
    claims: Dict,
    content: SignJwtContent<C>,
    options: SignJwtOptions = {},
  ): SignedJwt {
    return this.jwt(kryptos).signClaims(claims, content, options);
  }

  // private

  private jws(kryptos: IKryptos): JwsKit {
    return new JwsKit({
      certBindingMode: this.certBindingMode,
      kryptos,
      logger: this.logger,
    });
  }

  private jwe(kryptos: IKryptos): JweKit {
    return new JweKit({
      certBindingMode: this.certBindingMode,
      encryption: this.encryption,
      kryptos,
      logger: this.logger,
    });
  }

  private jwt(kryptos: IKryptos): JwtKit {
    return new JwtKit({
      certBindingMode: this.certBindingMode,
      clockTolerance: this.clockTolerance,
      dpopMaxSkew: this.dpopMaxSkew,
      issuer: this.issuer,
      kryptos,
      logger: this.logger,
    });
  }
}
