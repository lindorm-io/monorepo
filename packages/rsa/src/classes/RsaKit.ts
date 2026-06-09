import {
  type IKryptosRsa,
  KryptosKit,
  RSA_SIG_ALGORITHMS,
  type RsaSigAlgorithm,
} from "@lindorm/kryptos";
import type { DsaEncoding, IKeyKit, KeyData } from "@lindorm/types";
import { RsaError } from "../errors/index.js";
import type { RsaKitOptions } from "../types/index.js";
import {
  assertRsaSignature,
  createRsaSignature,
  verifyRsaSignature,
} from "../internal/index.js";

export class RsaKit implements IKeyKit {
  private readonly dsa: DsaEncoding;
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosRsa;

  public constructor(options: RsaKitOptions) {
    this.dsa = options.dsa ?? "der";
    this.encoding = options.encoding ?? "base64";

    if (!KryptosKit.isRsa(options.kryptos)) {
      throw new RsaError("Invalid Kryptos instance", {
        code: "invalid_kryptos_instance",
        title: "Invalid Kryptos Instance",
        details:
          "The provided Kryptos instance is not an RSA key and cannot be used with RsaKit.",
      });
    }

    if (!RSA_SIG_ALGORITHMS.includes(options.kryptos.algorithm as RsaSigAlgorithm)) {
      throw new RsaError(
        "RsaKit only supports signing algorithms (RS256, RS384, RS512, PS256, PS384, PS512)",
        {
          code: "unsupported_algorithm",
          title: "Unsupported Algorithm",
          details:
            "RsaKit only supports the RS256, RS384, RS512, PS256, PS384, and PS512 signing algorithms.",
          data: { algorithm: options.kryptos.algorithm },
        },
      );
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: KeyData): Buffer {
    return createRsaSignature({
      data,
      dsaEncoding: this.dsa,
      kryptos: this.kryptos,
    });
  }

  public verify(data: KeyData, signature: KeyData): boolean {
    return verifyRsaSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: KeyData, signature: KeyData): void {
    return assertRsaSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public format(data: Buffer): string {
    return data.toString(this.encoding);
  }
}
