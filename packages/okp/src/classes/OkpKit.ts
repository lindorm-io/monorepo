import { Kryptos, KryptosOkp } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { OkpError } from "../errors";
import { OkpKitOptions } from "../types";
import {
  _assertOkpSignature,
  _createOkpSignature,
  _verifyOkpSignature,
} from "../utils/private/okp-signature";

export class OkpKit {
  private readonly format: BufferFormat;
  private readonly kryptos: KryptosOkp;

  public constructor(options: OkpKitOptions) {
    this.format = options.format ?? "base64";

    if (!Kryptos.isOkp(options.kryptos)) {
      throw new OkpError("Invalid Kryptos instance");
    }

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
