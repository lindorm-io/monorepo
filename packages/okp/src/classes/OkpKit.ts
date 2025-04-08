import { IKryptosOkp, KryptosKit } from "@lindorm/kryptos";
import { BufferFormat, DsaEncoding, IKeyKit } from "@lindorm/types";
import { OkpError } from "../errors";
import { OkpKitOptions } from "../types";
import {
  assertOkpSignature,
  createOkpSignature,
  verifyOkpSignature,
} from "../utils/private";

export class OkpKit implements IKeyKit {
  private readonly dsa: DsaEncoding;
  private readonly format: BufferFormat;
  private readonly kryptos: IKryptosOkp;

  public constructor(options: OkpKitOptions) {
    this.dsa = options.dsa ?? "der";
    this.format = options.format ?? "base64";

    if (!KryptosKit.isOkp(options.kryptos)) {
      throw new OkpError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return createOkpSignature({
      data,
      dsa: this.dsa,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyOkpSignature({
      data,
      dsa: this.dsa,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertOkpSignature({
      data,
      dsa: this.dsa,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
