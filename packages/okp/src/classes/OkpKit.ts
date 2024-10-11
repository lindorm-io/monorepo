import { IKryptosOkp, Kryptos } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { OkpError } from "../errors";
import { OkpKitOptions } from "../types";
import {
  assertOkpSignature,
  createOkpSignature,
  verifyOkpSignature,
} from "../utils/private";

export class OkpKit {
  private readonly format: BufferFormat;
  private readonly kryptos: IKryptosOkp;

  public constructor(options: OkpKitOptions) {
    this.format = options.format ?? "base64";

    if (!Kryptos.isOkp(options.kryptos)) {
      throw new OkpError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return createOkpSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyOkpSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertOkpSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
