import { IKryptosAkp, KryptosKit } from "@lindorm/kryptos";
import { IKeyKit, KeyData } from "@lindorm/types";
import { AkpError } from "../errors";
import { AkpKitOptions } from "../types";
import { assertAkpSignature, createAkpSignature, verifyAkpSignature } from "../internal";

export class AkpKit implements IKeyKit {
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosAkp;

  public constructor(options: AkpKitOptions) {
    this.encoding = options.encoding ?? "base64";

    if (!KryptosKit.isAkp(options.kryptos)) {
      throw new AkpError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: KeyData): Buffer {
    return createAkpSignature({ data, kryptos: this.kryptos });
  }

  public verify(data: KeyData, signature: KeyData): boolean {
    return verifyAkpSignature({
      data,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: KeyData, signature: KeyData): void {
    return assertAkpSignature({
      data,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public format(data: Buffer): string {
    return data.toString(this.encoding);
  }
}
