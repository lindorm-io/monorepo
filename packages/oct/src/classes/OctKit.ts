import { IKryptosOct, Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { OctError } from "../errors";
import { OctKitOptions } from "../types";
import {
  assertOctSignature,
  createOctSignature,
  verifyOctSignature,
} from "../utils/private";

export class OctKit {
  private readonly format: BufferFormat;
  private readonly kryptos: IKryptosOct;

  public constructor(options: OctKitOptions) {
    this.format = options.format ?? "base64";

    if (!Kryptos.isOct(options.kryptos)) {
      throw new OctError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return createOctSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyOctSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertOctSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
