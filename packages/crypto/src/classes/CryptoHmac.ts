import { CryptoHmacOptions, HmacSignatureAlgorithm, HmacSignatureFormat } from "../types";
import { assertHmacSignature, createHmacSignature, verifyHmacSignature } from "../utils";

export class CryptoHmac {
  private readonly algorithm: HmacSignatureAlgorithm | undefined;
  private readonly format: HmacSignatureFormat | undefined;
  private readonly secret: string;

  public constructor(options: CryptoHmacOptions) {
    this.algorithm = options.algorithm;
    this.format = options.format;
    this.secret = options.secret;
  }

  public sign(data: string): string {
    return createHmacSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      secret: this.secret,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyHmacSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      secret: this.secret,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertHmacSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      secret: this.secret,
      signature,
    });
  }
}
