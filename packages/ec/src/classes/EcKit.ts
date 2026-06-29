import {
  EC_SIG_ALGORITHMS,
  type EcSigAlgorithm,
  type IKryptosEc,
  KryptosKit,
} from "@lindorm/kryptos";
import type { DsaEncoding, IKeyKit, KeyData } from "@lindorm/types";
import { EcError } from "../errors/index.js";
import type { EcKitOptions } from "../types/index.js";
import {
  assertEcSignature,
  createEcSignature,
  verifyEcSignature,
} from "../internal/index.js";

export class EcKit implements IKeyKit {
  private readonly dsa: DsaEncoding;
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosEc;
  private readonly raw: boolean;

  constructor(options: EcKitOptions) {
    this.dsa = options.dsa ?? "der";
    this.encoding = options.encoding ?? "base64";
    this.raw = options.raw ?? false;

    if (!KryptosKit.isEc(options.kryptos)) {
      throw new EcError("Invalid Kryptos instance", {
        code: "invalid_kryptos_instance",
        title: "Invalid Kryptos Instance",
        details:
          "The provided Kryptos instance is not an EC key and cannot be used with EcKit.",
      });
    }

    if (!EC_SIG_ALGORITHMS.includes(options.kryptos.algorithm as EcSigAlgorithm)) {
      throw new EcError("EcKit only supports signing algorithms (ES256, ES384, ES512)", {
        code: "unsupported_algorithm",
        title: "Unsupported Algorithm",
        details: "EcKit only supports the ES256, ES384, and ES512 signing algorithms.",
        data: { algorithm: options.kryptos.algorithm },
      });
    }

    this.kryptos = options.kryptos;
  }

  sign(data: KeyData): Buffer {
    return createEcSignature({
      data,
      dsaEncoding: this.dsa,
      kryptos: this.kryptos,
      raw: this.raw,
    });
  }

  verify(data: KeyData, signature: KeyData): boolean {
    return verifyEcSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      raw: this.raw,
      signature,
    });
  }

  assert(data: KeyData, signature: KeyData): void {
    return assertEcSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      raw: this.raw,
      signature,
    });
  }

  format(data: Buffer): string {
    return data.toString(this.encoding);
  }
}
