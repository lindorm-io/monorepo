import { IKryptosRsa, Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { RsaError } from "../errors";
import { RsaKitOptions } from "../types";
import {
  _assertRsaSignature,
  _createRsaSignature,
  _verifyRsaSignature,
} from "../utils/private/rsa-signature";

export class RsaKit {
  private readonly format: BufferFormat;
  private readonly kryptos: IKryptosRsa;

  public constructor(options: RsaKitOptions) {
    this.format = options.format ?? "base64";

    if (!Kryptos.isRsa(options.kryptos)) {
      throw new RsaError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return _createRsaSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return _verifyRsaSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return _assertRsaSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
