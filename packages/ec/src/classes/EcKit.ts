import {
  EC_SIG_ALGORITHMS,
  EcSigAlgorithm,
  IKryptosEc,
  KryptosKit,
} from "@lindorm/kryptos";
import { DsaEncoding, IKeyKit, KeyData } from "@lindorm/types";
import { EcError } from "../errors";
import { EcKitOptions } from "../types";
import {
  assertEcSignature,
  createEcSignature,
  verifyEcSignature,
} from "../utils/private";

export class EcKit implements IKeyKit {
  private readonly dsa: DsaEncoding;
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosEc;
  private readonly raw: boolean;

  public constructor(options: EcKitOptions) {
    this.dsa = options.dsa ?? "der";
    this.encoding = options.encoding ?? "base64";
    this.raw = options.raw ?? false;

    if (!KryptosKit.isEc(options.kryptos)) {
      throw new EcError("Invalid Kryptos instance");
    }

    if (!EC_SIG_ALGORITHMS.includes(options.kryptos.algorithm as EcSigAlgorithm)) {
      throw new EcError("EcKit only supports signing algorithms (ES256, ES384, ES512)");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: KeyData): Buffer {
    return createEcSignature({
      data,
      dsaEncoding: this.dsa,
      kryptos: this.kryptos,
      raw: this.raw,
    });
  }

  public verify(data: KeyData, signature: KeyData): boolean {
    return verifyEcSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      raw: this.raw,
      signature,
    });
  }

  public assert(data: KeyData, signature: KeyData): void {
    return assertEcSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      raw: this.raw,
      signature,
    });
  }

  public format(data: Buffer): string {
    return data.toString(this.encoding);
  }
}
