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
  KryptosFormat,
  KryptosFrom,
  KryptosFromBuffer,
  KryptosFromJwk,
  KryptosFromString,
  KryptosLike,
  KryptosMakeEcEnc,
  KryptosMakeEcSig,
  KryptosMakeOctEnc,
  KryptosMakeOctSig,
  KryptosMakeOkpEnc,
  KryptosMakeOkpSig,
  KryptosMakeRsaEnc,
  KryptosMakeRsaSig,
} from "../types";
import { KryptosMake } from "../types/private";
import {
  autoMakeConfig,
  calculateKeyOps,
  fromOptions,
  isB64,
  isDer,
  isJwk,
  isPem,
  makeKey,
} from "../utils/private";
import { Kryptos } from "./Kryptos";

type From = {
  auto(options: KryptosFrom): IKryptos;
  b64(options: KryptosFromString): IKryptos;
  der(options: KryptosFromBuffer): IKryptos;
  jwk(options: KryptosFromJwk): IKryptos;
  pem(options: KryptosFromString): IKryptos;
  utf(options: KryptosFromString): IKryptos;
};

type Encryption = {
  ec(options: KryptosMakeEcEnc): IKryptos;
  oct(options: KryptosMakeOctEnc): IKryptos;
  okp(options: KryptosMakeOkpEnc): IKryptos;
  rsa(options: KryptosMakeRsaEnc): IKryptos;
};

type Signature = {
  ec(options: KryptosMakeEcSig): IKryptos;
  oct(options: KryptosMakeOctSig): IKryptos;
  okp(options: KryptosMakeOkpSig): IKryptos;
  rsa(options: KryptosMakeRsaSig): IKryptos;
};

type Make = {
  auto(options: KryptosAuto): IKryptos;
  enc: Encryption;
  sig: Signature;
};

export class KryptosKit {
  // clone

  public static clone(kryptos: IKryptos): IKryptos {
    return new Kryptos({ ...kryptos.toJSON(), ...kryptos.export("der") });
  }

  // from

  public static get from(): From {
    return {
      auto: this.fromAuto,
      b64: this.fromB64,
      der: this.fromDer,
      jwk: this.fromJwk,
      pem: this.fromPem,
      utf: this.fromUtf,
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

  // make

  public static get make(): Make {
    return {
      auto: this.makeAuto,
      enc: this.encryption,
      sig: this.signature,
    };
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

    return new Kryptos(options);
  }

  // private make

  private static get encryption(): Encryption {
    return {
      ec: this.makeEcEnc,
      oct: this.makeOctEnc,
      okp: this.makeOkpEnc,
      rsa: this.makeRsaEnc,
    };
  }

  private static get signature(): Signature {
    return {
      ec: this.makeEcSig,
      oct: this.makeOctSig,
      okp: this.makeOkpSig,
      rsa: this.makeRsaSig,
    };
  }

  private static makeAuto(options: KryptosAuto): IKryptos {
    const config = autoMakeConfig(options.algorithm);
    const operations = calculateKeyOps(config.use);

    const make: KryptosMake = {
      ...config,
      ...options,
      operations,
    };

    return new Kryptos({
      ...make,
      ...makeKey(make),
    });
  }

  private static makeEcEnc(options: KryptosMakeEcEnc): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "EC",
      use: "enc",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeEcSig(options: KryptosMakeEcSig): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "EC",
      use: "sig",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeOctEnc(options: KryptosMakeOctEnc): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "oct",
      use: "enc",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeOctSig(options: KryptosMakeOctSig): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "oct",
      use: "sig",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeOkpEnc(options: KryptosMakeOkpEnc): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "OKP",
      use: "enc",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeOkpSig(options: KryptosMakeOkpSig): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "OKP",
      use: "sig",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeRsaEnc(options: KryptosMakeRsaEnc): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "RSA",
      use: "enc",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeRsaSig(options: KryptosMakeRsaSig): IKryptos {
    const make: KryptosMake = {
      ...options,
      type: "RSA",
      use: "sig",
    };
    return KryptosKit.makeKryptos(make);
  }

  private static makeKryptos(make: KryptosMake): IKryptos {
    return new Kryptos({
      ...make,
      operations: make.operations ?? calculateKeyOps(make.use),
      ...makeKey(make),
    });
  }
}
