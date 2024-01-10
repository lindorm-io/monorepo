import { KeySet } from "@lindorm-io/jwk";
import { BufferFormat, KeyObject, RsaSignatureOptions, SignatureAlgorithm } from "../types";
import { assertRsaSignature, createRsaSignature, verifyRsaSignature } from "../utils";

export class RsaSignature {
  private readonly algorithm: SignatureAlgorithm;
  private readonly format: BufferFormat;
  private readonly key: KeyObject | undefined;
  private readonly keySet: KeySet | undefined;

  public constructor(options: RsaSignatureOptions) {
    this.algorithm = options.algorithm || "RSA-SHA256";
    this.format = options.format || "base64url";
    this.key = options.key;
    this.keySet = options.keySet;
  }

  public sign(data: string): string {
    return createRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.key,
      keySet: this.keySet,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.key,
      keySet: this.keySet,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertRsaSignature({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.key,
      keySet: this.keySet,
      signature,
    });
  }
}
