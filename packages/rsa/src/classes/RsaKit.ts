import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, RsaKitOptions, SignatureAlgorithm } from "../types";
import {
  assertRsaSignature,
  createRsaSignature,
  verifyRsaSignature,
} from "../utils/private/rsa-signature";

export class RsaKit {
  private readonly algorithm: SignatureAlgorithm;
  private readonly format: BufferFormat;
  private readonly kryptos: Kryptos;

  public constructor(options: RsaKitOptions) {
    this.algorithm = options.algorithm || "RSA-SHA256";
    this.format = options.format || "base64url";
    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return createRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
