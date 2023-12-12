import { CryptoError } from "../errors";
import { CryptoRsaOptions, RsaSignatureAlgorithm, RsaSignatureFormat } from "../types";
import { assertRsaSignature, createRsaSignature, verifyRsaSignature } from "../utils";

export class CryptoRsa {
  private readonly algorithm: RsaSignatureAlgorithm | undefined;
  private readonly format: RsaSignatureFormat | undefined;
  private readonly passphrase: string | undefined;
  private readonly privateKey: string | undefined;
  private readonly publicKey: string | undefined;

  public constructor(options: CryptoRsaOptions) {
    this.algorithm = options.algorithm;
    this.format = options.format;
    this.passphrase = options.passphrase;
    this.privateKey = options.privateKey;
    this.publicKey = options.publicKey;
  }

  public sign(data: string): string {
    if (!this.privateKey) {
      throw new CryptoError("Missing private key");
    }

    return createRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.passphrase
        ? {
            key: this.privateKey,
            passphrase: this.passphrase,
          }
        : this.privateKey,
    });
  }

  public verify(data: string, signature: string): boolean {
    if (!this.publicKey) {
      throw new CryptoError("Missing public key");
    }

    return verifyRsaSignature({
      algorithm: this.algorithm,
      data,
      signature,
      format: this.format,
      key: this.publicKey,
    });
  }

  public assert(data: string, signature: string): void {
    if (!this.publicKey) {
      throw new CryptoError("Missing public key");
    }

    return assertRsaSignature({
      algorithm: this.algorithm,
      data,
      signature,
      format: this.format,
      key: this.publicKey,
    });
  }
}
