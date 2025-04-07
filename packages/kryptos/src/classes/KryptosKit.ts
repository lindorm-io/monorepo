import { KryptosError } from "../errors";
import {
  IKryptos,
  IKryptosEc,
  IKryptosOct,
  IKryptosOkp,
  IKryptosRsa,
} from "../interfaces";
import {
  KryptosAlgorithm,
  KryptosAttributes,
  KryptosAuto,
  KryptosCurve,
  KryptosEncryption,
  KryptosFormat,
  KryptosFrom,
  KryptosFromBuffer,
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
  KryptosOperation,
  KryptosType,
  KryptosUse,
} from "../types";
import { KryptosGenerate } from "../types/private";
import {
  autoGenerateConfig,
  calculateKeyOps,
  fromOptions,
  generateKey,
  isB64,
  isDer,
  isJwk,
  isPem,
} from "../utils/private";
import { Kryptos } from "./Kryptos";

const KRYPTOS = "kryptos" as const;

type Env = {
  import(string: string): IKryptos;
  export(kryptos: IKryptos): string;
};

type From = {
  auto(options: KryptosFrom): IKryptos;
  b64(options: KryptosFromString): IKryptos;
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
      der: KryptosKit.fromDer,
      jwk: KryptosKit.fromJwk,
      pem: KryptosKit.fromPem,
      utf: KryptosKit.fromUtf,
    };
  }

  // is

  public static isEc(kryptos: KryptosLike): kryptos is IKryptosEc {
    return (
      kryptos instanceof Kryptos && kryptos.type === "EC" && kryptos.curve !== undefined
    );
  }

  public static isOct(kryptos: KryptosLike): kryptos is IKryptosOct {
    return (
      kryptos instanceof Kryptos && kryptos.type === "oct" && kryptos.curve === undefined
    );
  }

  public static isOkp(kryptos: KryptosLike): kryptos is IKryptosOkp {
    return (
      kryptos instanceof Kryptos && kryptos.type === "OKP" && kryptos.curve !== undefined
    );
  }

  public static isRsa(kryptos: KryptosLike): kryptos is IKryptosRsa {
    return (
      kryptos instanceof Kryptos && kryptos.type === "RSA" && kryptos.curve === undefined
    );
  }

  // generate

  public static get generate(): Generate {
    return {
      auto: this.generateAuto,
      enc: this.encryption,
      sig: this.signature,
    };
  }

  // private env

  private static envImport(string: string): IKryptos {
    const init: Array<string> = string.split(":");
    const [kryptos, rest] = init;

    if (kryptos !== KRYPTOS) {
      throw new KryptosError("Invalid kryptos string");
    }

    const result: Array<string> = rest.split(".");

    const [
      id,
      algorithm,
      curve,
      encryption,
      operations,
      privateKey,
      publicKey,
      purpose,
      type,
      use,
    ] = result;

    return KryptosKit.fromB64({
      id: id,
      algorithm: algorithm as KryptosAlgorithm,
      curve: (curve as KryptosCurve) || undefined,
      encryption: (encryption as KryptosEncryption) || undefined,
      operations: operations.split(",") as Array<KryptosOperation>,
      privateKey: privateKey || undefined,
      publicKey: publicKey || undefined,
      purpose: purpose || undefined,
      type: type as KryptosType,
      use: use as KryptosUse,
    });
  }

  private static envExport(kryptos: IKryptos): string {
    const json: KryptosAttributes = kryptos.toJSON();
    const b64 = kryptos.export("b64");

    const result: Array<string | undefined> = [
      json.id,
      b64.algorithm,
      b64.curve,
      json.encryption,
      json.operations.join(","),
      b64.privateKey,
      b64.publicKey,
      json.purpose,
      b64.type,
      b64.use,
    ];

    return KRYPTOS + ":" + result.map((i) => (i ? i : "")).join(".");
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
      ec: this.GenerateEcSig,
      oct: this.generateOctSig,
      okp: this.generateOkpSig,
      rsa: this.generateRsaSig,
    };
  }

  private static generateAuto(options: KryptosAuto): IKryptos {
    const config = autoGenerateConfig(options.algorithm);
    const operations = calculateKeyOps(config);

    const generate: KryptosGenerate = {
      ...config,
      ...options,
      operations,
    };

    return new Kryptos({
      ...generate,
      ...generateKey(generate),
    });
  }

  private static generateEcEnc(options: KryptosGenerateEcEnc): IKryptos {
    const generate: KryptosGenerate = {
      ...options,
      type: "EC",
      use: "enc",
    };
    return KryptosKit.generateKryptos(generate);
  }

  private static GenerateEcSig(options: KryptosGenerateEcSig): IKryptos {
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
      operations: generate.operations?.length
        ? generate.operations
        : calculateKeyOps(generate),
      ...generateKey(generate),
    });
  }
}
