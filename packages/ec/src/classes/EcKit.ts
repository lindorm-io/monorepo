import { Kryptos } from "@lindorm/kryptos";
import { EcSignatureAlgorithm, EcSignatureFormat, EcKitOptions } from "../types";
import {
  _assertEcSignature,
  _createEcSignature,
  _verifyEcSignature,
} from "../utils/private/ec-signature";

export class EcKit {
  private readonly algorithm: EcSignatureAlgorithm | undefined;
  private readonly format: EcSignatureFormat | undefined;
  private readonly kryptos: Kryptos;

  public constructor(options: EcKitOptions) {
    this.algorithm = options.algorithm;
    this.format = options.format;
    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return _createEcSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return _verifyEcSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return _assertEcSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
