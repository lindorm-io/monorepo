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

  // public static

  public static S256(data: string): string {
    return createShaHash({
      algorithm: "SHA256",
      data,
      encoding: "base64url",
    });
  }

  public static S384(data: string): string {
    return createShaHash({
      algorithm: "SHA384",
      data,
      encoding: "base64url",
    });
  }

  public static S512(data: string): string {
    return createShaHash({
      algorithm: "SHA512",
      data,
      encoding: "base64url",
    });
  }

  // public

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
