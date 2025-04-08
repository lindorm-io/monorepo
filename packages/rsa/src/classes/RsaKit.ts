import { IKryptosRsa, KryptosKit } from "@lindorm/kryptos";
import { BufferFormat, DsaEncoding, IKeyKit } from "@lindorm/types";
import { RsaError } from "../errors";
import { RsaKitOptions } from "../types";
import {
  assertRsaSignature,
  createRsaSignature,
  verifyRsaSignature,
} from "../utils/private";

export class RsaKit implements IKeyKit {
  private readonly dsa: DsaEncoding;
  private readonly format: BufferFormat;
  private readonly kryptos: IKryptosRsa;

  public constructor(options: RsaKitOptions) {
    this.dsa = options.dsa ?? "der";
    this.format = options.format ?? "base64";

    if (!KryptosKit.isRsa(options.kryptos)) {
      throw new RsaError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return createRsaSignature({
      data,
      dsa: this.dsa,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyRsaSignature({
      data,
      dsa: this.dsa,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertRsaSignature({
      data,
      dsa: this.dsa,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
