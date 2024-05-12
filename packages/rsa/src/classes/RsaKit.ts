import { Kryptos } from "@lindorm/kryptos";
import { RsaKitOptions, RsaSignatureAlgorithm, RsaSignatureFormat } from "../types";
import {
  _assertRsaSignature,
  _createRsaSignature,
  _verifyRsaSignature,
} from "../utils/private/rsa-signature";

export class RsaKit {
  private readonly algorithm: RsaSignatureAlgorithm;
  private readonly format: RsaSignatureFormat;
  private readonly kryptos: Kryptos;

  public constructor(options: RsaKitOptions) {
    this.algorithm = options.algorithm || "RSA-SHA256";
    this.format = options.format || "base64url";
    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return _createRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return _verifyRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return _assertRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
