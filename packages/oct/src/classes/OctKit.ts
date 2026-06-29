import {
  type IKryptosOct,
  KryptosKit,
  OCT_SIG_ALGORITHMS,
  type OctSigAlgorithm,
} from "@lindorm/kryptos";
import type { IKeyKit, KeyData } from "@lindorm/types";
import { OctError } from "../errors/index.js";
import type { OctKitOptions } from "../types/index.js";
import {
  assertOctSignature,
  createOctSignature,
  verifyOctSignature,
} from "../internal/index.js";

export class OctKit implements IKeyKit {
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosOct;

  constructor(options: OctKitOptions) {
    this.encoding = options.encoding ?? "base64";

    if (!KryptosKit.isOct(options.kryptos)) {
      throw new OctError("Invalid Kryptos instance", {
        code: "invalid_kryptos_instance",
        title: "Invalid Kryptos Instance",
        details:
          "The provided Kryptos instance is not an oct key and cannot be used with OctKit.",
      });
    }

    if (!OCT_SIG_ALGORITHMS.includes(options.kryptos.algorithm as OctSigAlgorithm)) {
      throw new OctError(
        "OctKit only supports signing algorithms (HS256, HS384, HS512)",
        {
          code: "unsupported_algorithm",
          title: "Unsupported Algorithm",
          details: "OctKit only supports the HS256, HS384, and HS512 signing algorithms.",
          data: { algorithm: options.kryptos.algorithm },
        },
      );
    }

    this.kryptos = options.kryptos;
  }

  sign(data: KeyData): Buffer {
    return createOctSignature({
      data,
      kryptos: this.kryptos,
    });
  }

  verify(data: KeyData, signature: KeyData): boolean {
    return verifyOctSignature({
      data,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  assert(data: KeyData, signature: KeyData): void {
    return assertOctSignature({
      data,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  format(data: Buffer): string {
    return data.toString(this.encoding);
  }
}
