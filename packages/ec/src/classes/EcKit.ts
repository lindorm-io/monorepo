import { Kryptos } from "@lindorm/kryptos";
import { EcKitOptions, EcSignatureFormat } from "../types";
import {
  _assertEcSignature,
  _createEcSignature,
  _verifyEcSignature,
} from "../utils/private/ec-signature";

export class EcKit {
  private readonly format: EcSignatureFormat;
  private readonly kryptos: Kryptos;

  public constructor(options: EcKitOptions) {
    this.format = options.format ?? "base64";
    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return _createEcSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return _verifyEcSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return _assertEcSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
