import { Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { OctKitOptions } from "../types";
import {
  _assertOctSignature,
  _createOctSignature,
  _verifyOctSignature,
} from "../utils/private/oct-signature";

export class OctKit {
  private readonly format: BufferFormat;
  private readonly kryptos: Kryptos;

  public constructor(options: OctKitOptions) {
    this.format = options.format ?? "base64";
    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return _createOctSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return _verifyOctSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return _assertOctSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
