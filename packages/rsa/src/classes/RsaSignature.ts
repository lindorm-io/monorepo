import { RsaAlgorithm, RsaFormat } from "../enums";
import { RsaPrivateKey, RsaPublicKey, RsaSignatureOptions } from "../types";
import { assertRsaSignature, createRsaSignature, verifyRsaSignature } from "../utils";

export class RsaSignature {
  private readonly algorithm: RsaAlgorithm;
  private readonly format: RsaFormat;
  private readonly publicKey: RsaPublicKey | undefined;
  private readonly privateKey: RsaPrivateKey | undefined;

  public constructor(options: RsaSignatureOptions) {
    this.algorithm = options.algorithm || RsaAlgorithm.RSA_SHA256;
    this.format = options.format || RsaFormat.BASE64;
    this.publicKey = options.publicKey;
    this.privateKey = options.privateKey;
  }

  public sign(data: string): string {
    if (!this.privateKey) {
      throw new Error("Missing private key");
    }

    return createRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.privateKey,
    });
  }

  public verify(data: string, signature: string): boolean {
    if (!this.publicKey) {
      throw new Error("Missing public key");
    }

    return verifyRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.publicKey,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    if (!this.publicKey) {
      throw new Error("Missing public key");
    }

    assertRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.publicKey,
      signature,
    });
  }
}
