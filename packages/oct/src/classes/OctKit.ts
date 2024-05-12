import { Kryptos } from "@lindorm/kryptos";
import { OctKitOptions, OctSignatureAlgorithm, OctSignatureFormat } from "../types";
import {
  _assertOctSignature,
  _createOctSignature,
  _verifyOctSignature,
} from "../utils/private/oct-signature";

export class OctKit {
  private readonly algorithm: OctSignatureAlgorithm | undefined;
  private readonly format: OctSignatureFormat | undefined;
  private readonly kryptos: Kryptos;

  public constructor(options: OctKitOptions) {
    this.algorithm = options.algorithm;
    this.format = options.format;
    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return _createOctSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return _verifyOctSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return _assertOctSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
