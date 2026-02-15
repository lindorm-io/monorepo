import {
  IKryptosOct,
  KryptosKit,
  OCT_SIG_ALGORITHMS,
  OctSigAlgorithm,
} from "@lindorm/kryptos";
import { IKeyKit, KeyData } from "@lindorm/types";
import { OctError } from "../errors";
import { OctKitOptions } from "../types";
import {
  assertOctSignature,
  createOctSignature,
  verifyOctSignature,
} from "../utils/private";

export class OctKit implements IKeyKit {
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosOct;

  public constructor(options: OctKitOptions) {
    this.encoding = options.encoding ?? "base64";

    if (!KryptosKit.isOct(options.kryptos)) {
      throw new OctError("Invalid Kryptos instance");
    }

    if (!OCT_SIG_ALGORITHMS.includes(options.kryptos.algorithm as OctSigAlgorithm)) {
      throw new OctError("OctKit only supports signing algorithms (HS256, HS384, HS512)");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: KeyData): Buffer {
    return createOctSignature({
      data,
      kryptos: this.kryptos,
    });
  }

  public verify(data: KeyData, signature: KeyData): boolean {
    return verifyOctSignature({
      data,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: KeyData, signature: KeyData): void {
    return assertOctSignature({
      data,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public format(data: Buffer): string {
    return data.toString(this.encoding);
  }
}
