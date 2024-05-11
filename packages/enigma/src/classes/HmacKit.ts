import { HmacHashAlgorithm, HmacHashFormat, HmacKitOptions } from "../types";
import { _assertHmacHash, _createHmacHash, _verifyHmacHash } from "../utils/private/hmac-hash";

export class HmacKit {
  private readonly algorithm: HmacHashAlgorithm | undefined;
  private readonly format: HmacHashFormat | undefined;
  private readonly secret: string;

  public constructor(options: HmacKitOptions) {
    this.algorithm = options.algorithm;
    this.format = options.format;
    this.secret = options.secret;
  }

  public hash(data: string): string {
    return _createHmacHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      secret: this.secret,
    });
  }

  public verify(data: string, hash: string): boolean {
    return _verifyHmacHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      secret: this.secret,
      hash,
    });
  }

  public assert(data: string, hash: string): void {
    return _assertHmacHash({
      algorithm: this.algorithm,
      data,
      format: this.format,
      secret: this.secret,
      hash,
    });
  }
}
