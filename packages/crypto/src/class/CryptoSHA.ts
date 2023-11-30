import { CryptoShaOptions, ShaHashAlgorithm, ShaHashFormat } from "../types";
import { assertShaHash, createShaHash, verifyShaHash } from "../utils";

export class CryptoSha {
  private readonly algorithm: ShaHashAlgorithm | undefined;
  private readonly format: ShaHashFormat | undefined;

  public constructor(options: CryptoShaOptions = {}) {
    this.algorithm = options.algorithm;
    this.format = options.format;
  }

  public hash(data: string): string {
    return createShaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
    });
  }

  public verify(data: string, hash: string): boolean {
    return verifyShaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      hash,
    });
  }

  public assert(data: string, hash: string): void {
    return assertShaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      hash,
    });
  }
}
