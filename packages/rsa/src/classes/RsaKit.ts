import { IKryptosRsa, KryptosKit } from "@lindorm/kryptos";
import { DsaEncoding, IKeyKit, KeyData } from "@lindorm/types";
import { RsaError } from "../errors";
import { RsaKitOptions } from "../types";
import {
  assertRsaSignature,
  createRsaSignature,
  verifyRsaSignature,
} from "../utils/private";

export class RsaKit implements IKeyKit {
  private readonly dsa: DsaEncoding;
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosRsa;

  public constructor(options: RsaKitOptions) {
    this.dsa = options.dsa ?? "der";
    this.encoding = options.encoding ?? "base64";

    if (!KryptosKit.isRsa(options.kryptos)) {
      throw new RsaError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: KeyData): Buffer {
    return createRsaSignature({
      data,
      dsaEncoding: this.dsa,
      kryptos: this.kryptos,
    });
  }

  public verify(data: KeyData, signature: KeyData): boolean {
    return verifyRsaSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: KeyData, signature: KeyData): void {
    return assertRsaSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public format(data: Buffer): string {
    return data.toString(this.encoding);
  }
}
