import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat, HashAlgorithm, RsaKitOptions } from "../types";
import { _assertRsaHash, _createRsaHash, _verifyRsaHash } from "../utils/private/rsa-hash";

export class RsaKit {
  private readonly algorithm: HashAlgorithm;
  private readonly format: BufferFormat;
  private readonly kryptos: Kryptos;

  public constructor(options: RsaKitOptions) {
    this.algorithm = options.algorithm || "RSA-SHA256";
    this.format = options.format || "base64url";
    this.kryptos = options.kryptos;
  }

  public hash(data: string): string {
    return _createRsaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, hash: string): boolean {
    return _verifyRsaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      hash,
    });
  }

  public assert(data: string, hash: string): void {
    return _assertRsaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      kryptos: this.kryptos,
      hash,
    });
  }
}
