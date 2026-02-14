import { B64 } from "@lindorm/b64";
import { KryptosError } from "../errors";
import {
  IKryptos,
  IKryptosEc,
  IKryptosOct,
  IKryptosOkp,
  IKryptosRsa,
} from "../interfaces";
import {
  KryptosAuto,
  KryptosDB,
  KryptosFormat,
  KryptosFrom,
  KryptosFromBuffer,
  KryptosFromDb,
  KryptosFromJwk,
  KryptosFromString,
  KryptosGenerateEcEnc,
  KryptosGenerateEcSig,
  KryptosGenerateOctEnc,
  KryptosGenerateOctSig,
  KryptosGenerateOkpEnc,
  KryptosGenerateOkpSig,
  KryptosGenerateRsaEnc,
  KryptosGenerateRsaSig,
  KryptosLike,
} from "../types";
import { KryptosGenerate } from "../types/private";
import {
  autoGenerateConfig,
  calculateKeyOps,
  fromOptions,
  generateKey,
  generateKeyAsync,
  isB64,
  isDer,
  isJwk,
  isPem,
} from "../utils/private";
import { Kryptos } from "./Kryptos";

type Env = {
  import(string: string): IKryptos;
  export(kryptos: IKryptos): string;
};

type From = {
  auto(options: KryptosFrom): IKryptos;
  b64(options: KryptosFromString): IKryptos;
  db(options: KryptosDB): IKryptos;
  der(options: KryptosFromBuffer): IKryptos;
  jwk(options: KryptosFromJwk): IKryptos;
  pem(options: KryptosFromString): IKryptos;
  utf(options: KryptosFromString): IKryptos;
};

type Encryption = {
  ec(options: KryptosGenerateEcEnc): IKryptos;
  oct(options: KryptosGenerateOctEnc): IKryptos;
  okp(options: KryptosGenerateOkpEnc): IKryptos;
  rsa(options: KryptosGenerateRsaEnc): IKryptos;
};

type Signature = {
  ec(options: KryptosGenerateEcSig): IKryptos;
  oct(options: KryptosGenerateOctSig): IKryptos;
  okp(options: KryptosGenerateOkpSig): IKryptos;
  rsa(options: KryptosGenerateRsaSig): IKryptos;
};

type Generate = {
  auto(options: KryptosAuto): IKryptos;
  enc: Encryption;
  sig: Signature;
};

type AsyncEncryption = {
  ec(options: KryptosGenerateEcEnc): Promise<IKryptos>;
  oct(options: KryptosGenerateOctEnc): Promise<IKryptos>;
  okp(options: KryptosGenerateOkpEnc): Promise<IKryptos>;
  rsa(options: KryptosGenerateRsaEnc): Promise<IKryptos>;
};

type AsyncSignature = {
  ec(options: KryptosGenerateEcSig): Promise<IKryptos>;
  oct(options: KryptosGenerateOctSig): Promise<IKryptos>;
  okp(options: KryptosGenerateOkpSig): Promise<IKryptos>;
  rsa(options: KryptosGenerateRsaSig): Promise<IKryptos>;
};

type GenerateAsync = {
  auto(options: KryptosAuto): Promise<IKryptos>;
  enc: AsyncEncryption;
  sig: AsyncSignature;
};

export class KryptosKit {
  // clone

  public static clone(kryptos: IKryptos, overwrite: KryptosLike = {}): IKryptos {
    return new Kryptos({ ...kryptos.toJSON(), ...overwrite, ...kryptos.export("der") });
  }

  // env

  public static get env(): Env {
    return {
      import: KryptosKit.envImport,
      export: KryptosKit.envExport,
    };
  }

  // from

  public static get from(): From {
    return {
      auto: KryptosKit.fromAuto,
      b64: KryptosKit.fromB64,
      db: KryptosKit.fromDb,
      der: KryptosKit.fromDer,
      jwk: KryptosKit.fromJwk,
      pem: KryptosKit.fromPem,
      utf: KryptosKit.fromUtf,
    };
  }

  // is

  public static isEc(kryptos: KryptosLike): kryptos is IKryptosEc {
    return kryptos instanceof Kryptos && kryptos.type === "EC" && Boolean(kryptos.curve);
  }

  public static isOct(kryptos: KryptosLike): kryptos is IKryptosOct {
    return kryptos instanceof Kryptos && kryptos.type === "oct" && !kryptos.curve;
  }

  public static isOkp(kryptos: KryptosLike): kryptos is IKryptosOkp {
    return kryptos instanceof Kryptos && kryptos.type === "OKP" && Boolean(kryptos.curve);
  }

  public static isRsa(kryptos: KryptosLike): kryptos is IKryptosRsa {
    return kryptos instanceof Kryptos && kryptos.type === "RSA" && !kryptos.curve;
  }

  // generate

  public static get generate(): Generate {
    return {
      auto: this.generateAuto,
      enc: this.encryption,
      sig: this.signature,
    };
  }

  // generateAsync

  public static get generateAsync(): GenerateAsync {
    return {
      auto: this.generateAutoAsync,
      enc: this.encryptionAsync,
      sig: this.signatureAsync,
    };
  }

  // private env

  private static envImport(string: string): IKryptos {
    if (!string.startsWith("kryptos:")) {
      throw new KryptosError("Invalid kryptos string");
    }

    const [_, jwk] = string.split(":");

    return KryptosKit.fromJwk(JSON.parse(B64.decode(jwk, "b64u")));
  }

  private static envExport(kryptos: IKryptos): string {
    return kryptos.toEnvString();
  }

  // private from

  private static fromAuto(options: KryptosFrom): IKryptos {
    if (isB64(options)) return KryptosKit.fromB64(options);
    if (isDer(options)) return KryptosKit.fromDer(options);
    if (isJwk(options)) return KryptosKit.fromJwk(options);
    if (isPem(options)) return KryptosKit.fromPem(options);

    throw new KryptosError("Unexpected key format");
  }

  private static fromB64(options: KryptosFromString): IKryptos {
    return KryptosKit.fromKryptos("b64", options);
  }

  private static fromDb(options: KryptosFromDb): IKryptos {
    const { curve, encryption, privateKey, publicKey, ...rest } = options;

    return KryptosKit.fromKryptos("b64", {
      ...rest,
      curve: curve ?? undefined,
      encryption: encryption ?? undefined,
      privateKey: privateKey ?? undefined,
      publicKey: publicKey ?? undefined,
    });
  }

  private static fromDer(options: KryptosFromBuffer): IKryptos {
    return KryptosKit.fromKryptos("der", options);
  }

  private static fromJwk(options: KryptosFromJwk): IKryptos {
    return KryptosKit.fromKryptos("jwk", options);
  }

  private static fromPem(options: KryptosFromString): IKryptos {
    return KryptosKit.fromKryptos("pem", options);
  }

  private static fromUtf(options: KryptosFromString): IKryptos {
    return KryptosKit.fromKryptos("utf", options);
  }

  private static fromKryptos(format: KryptosFormat, arg: KryptosFrom): Kryptos {
    const options = fromOptions(format, arg);

    if (!options.algorithm) {
      throw new KryptosError("Algorithm is required");
    }
    if (!options.type) {
      throw new KryptosError("Type is required");
    }
    if (!options.use) {
      throw new KryptosError("Use is required");
    }

    return new Kryptos({
      ...options,
      operations: options.operations?.length
        ? options.operations
        : calculateKeyOps(options),
    });
  }

  // private generate

  private static get encryption(): Encryption {
    return {
      ec: this.generateEcEnc,
      oct: this.generateOctEnc,
      okp: this.generateOkpEnc,
      rsa: this.generateRsaEnc,
    };
  }

  private static get signature(): Signature {
    return {
      ec: this.generateEcSig,
      oct: this.generateOctSig,
      okp: this.generateOkpSig,
      rsa: this.generateRsaSig,
    };
  }

  private static generateAuto(options: KryptosAuto): IKryptos {
    const config = autoGenerateConfig(options.algorithm);
    const operations = calculateKeyOps(config);

    if (config.purpose && ["cookie", "session"].includes(config.purpose)) {
      config.hidden = config.hidden ?? true;
    }

    const generate: KryptosGenerate = {
      ...config,
      ...options,
      operations,
    };

    return new Kryptos({ ...generate, ...generateKey(generate) });
  }

  private static generateEcEnc(options: KryptosGenerateEcEnc): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "EC",
      use: "enc",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateEcSig(options: KryptosGenerateEcSig): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "EC",
      use: "sig",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateOctEnc(options: KryptosGenerateOctEnc): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "oct",
      use: "enc",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateOctSig(options: KryptosGenerateOctSig): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "oct",
      use: "sig",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateOkpEnc(options: KryptosGenerateOkpEnc): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "OKP",
      use: "enc",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateOkpSig(options: KryptosGenerateOkpSig): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "OKP",
      use: "sig",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateRsaEnc(options: KryptosGenerateRsaEnc): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "RSA",
      use: "enc",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateRsaSig(options: KryptosGenerateRsaSig): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "RSA",
      use: "sig",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static generateKryptos(generate: KryptosGenerate): IKryptos {
    return new Kryptos({
      ...generate,
      encryption: generate.use === "enc" ? (generate.encryption ?? "A256GCM") : null,
      operations: generate.operations?.length
        ? generate.operations
        : calculateKeyOps(generate),
      ...generateKey(generate),
    });
  }

  // private generateAsync

  private static get encryptionAsync(): AsyncEncryption {
    return {
      ec: this.generateEcEncAsync,
      oct: this.generateOctEncAsync,
      okp: this.generateOkpEncAsync,
      rsa: this.generateRsaEncAsync,
    };
  }

  private static get signatureAsync(): AsyncSignature {
    return {
      ec: this.generateEcSigAsync,
      oct: this.generateOctSigAsync,
      okp: this.generateOkpSigAsync,
      rsa: this.generateRsaSigAsync,
    };
  }

  private static async generateAutoAsync(options: KryptosAuto): Promise<IKryptos> {
    const config = autoGenerateConfig(options.algorithm);
    const operations = calculateKeyOps(config);

    if (config.purpose && ["cookie", "session"].includes(config.purpose)) {
      config.hidden = config.hidden ?? true;
    }

    const generate: KryptosGenerate = {
      ...config,
      ...options,
      operations,
    };

    return new Kryptos({ ...generate, ...(await generateKeyAsync(generate)) });
  }

  private static async generateEcEncAsync(
    options: KryptosGenerateEcEnc,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "EC", use: "enc" });
  }

  private static async generateEcSigAsync(
    options: KryptosGenerateEcSig,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "EC", use: "sig" });
  }

  private static async generateOctEncAsync(
    options: KryptosGenerateOctEnc,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "oct", use: "enc" });
  }

  private static async generateOctSigAsync(
    options: KryptosGenerateOctSig,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "oct", use: "sig" });
  }

  private static async generateOkpEncAsync(
    options: KryptosGenerateOkpEnc,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "OKP", use: "enc" });
  }

  private static async generateOkpSigAsync(
    options: KryptosGenerateOkpSig,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "OKP", use: "sig" });
  }

  private static async generateRsaEncAsync(
    options: KryptosGenerateRsaEnc,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "RSA", use: "enc" });
  }

  private static async generateRsaSigAsync(
    options: KryptosGenerateRsaSig,
  ): Promise<IKryptos> {
    return KryptosKit.generateKryptosAsync({ ...options, type: "RSA", use: "sig" });
  }

  private static async generateKryptosAsync(
    generate: KryptosGenerate,
  ): Promise<IKryptos> {
    return new Kryptos({
      ...generate,
      encryption: generate.use === "enc" ? (generate.encryption ?? "A256GCM") : null,
      operations: generate.operations?.length
        ? generate.operations
        : calculateKeyOps(generate),
      ...(await generateKeyAsync(generate)),
    });
  }
}
