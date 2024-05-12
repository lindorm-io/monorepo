import { Kryptos } from "@lindorm/kryptos";
import { OkpKitOptions, OkpSignatureFormat } from "../types";
import {
  _assertOkpSignature,
  _createOkpSignature,
  _verifyOkpSignature,
} from "../utils/private/okp-signature";

export class OkpKit {
  private readonly format: OkpSignatureFormat | undefined;
  private readonly kryptos: Kryptos;

  public constructor(options: OkpKitOptions) {
    this.format = options.format;
    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return _createOkpSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return _verifyOkpSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return _assertOkpSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
