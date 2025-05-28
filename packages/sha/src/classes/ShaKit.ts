import { ShaAlgorithm } from "@lindorm/types";
import { BinaryToTextEncoding } from "crypto";
import { ShaKitOptions } from "../types";
import { assertShaHash, createShaHash, verifyShaHash } from "../utils/private";

export class ShaKit {
  private readonly algorithm: ShaAlgorithm | undefined;
  private readonly encoding: BinaryToTextEncoding | undefined;

  public constructor(options: ShaKitOptions = {}) {
    this.algorithm = options.algorithm ?? "SHA256";
    this.encoding = options.encoding ?? "base64";
  }

  public hash(data: string): string {
    return createShaHash({
      algorithm: this.algorithm,
      data,
      encoding: this.encoding,
    });
  }

  public verify(data: string, hash: string): boolean {
    return verifyShaHash({
      algorithm: this.algorithm,
      data,
      encoding: this.encoding,
      hash,
    });
  }

  public assert(data: string, hash: string): void {
    return assertShaHash({
      algorithm: this.algorithm,
      data,
      encoding: this.encoding,
      hash,
    });
  }
}
