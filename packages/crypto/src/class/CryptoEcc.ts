import { CryptoError } from "../error";
import { CryptoEccOptions, EccSignatureAlgorithm, EccSignatureFormat } from "../types";
import { assertEccSignature, createEccSignature, verifyEccSignature } from "../utils";

export class CryptoEcc {
  private readonly algorithm: EccSignatureAlgorithm | undefined;
  private readonly format: EccSignatureFormat | undefined;
  private readonly privateKey: string | undefined;
  private readonly publicKey: string | undefined;

  public constructor(options: CryptoEccOptions) {
    this.algorithm = options.algorithm;
    this.format = options.format;
    this.privateKey = options.privateKey;
    this.publicKey = options.publicKey;
  }

  public sign(data: string): string {
    if (!this.privateKey) {
      throw new CryptoError("Missing private key");
    }

    return createEccSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.privateKey,
    });
  }

  public verify(data: string, signature: string): boolean {
    if (!this.publicKey) {
      throw new CryptoError("Missing public key");
    }

    return verifyEccSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.publicKey,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    if (!this.publicKey) {
      throw new CryptoError("Missing public key");
    }

    return assertEccSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.publicKey,
      signature,
    });
  }
}
