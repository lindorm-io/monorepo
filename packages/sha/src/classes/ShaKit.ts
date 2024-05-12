import { ShaHashAlgorithm, ShaHashFormat, ShaKitOptions } from "../types";
import { _assertShaHash, _createShaHash, _verifyShaHash } from "../utils/private/sha-hash";

export class ShaKit {
  private readonly algorithm: ShaHashAlgorithm | undefined;
  private readonly format: ShaHashFormat | undefined;

  public constructor(options: ShaKitOptions = {}) {
    this.algorithm = options.algorithm;
    this.format = options.format;
  }

  public hash(data: string): string {
    return _createShaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
    });
  }

  public verify(data: string, hash: string): boolean {
    return _verifyShaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      hash,
    });
  }

  public assert(data: string, hash: string): void {
    return _assertShaHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      hash,
    });
  }
}
