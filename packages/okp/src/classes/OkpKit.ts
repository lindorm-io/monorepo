import { IKryptosOkp, KryptosKit, OKP_SIG_CURVES, OkpSigCurve } from "@lindorm/kryptos";
import { DsaEncoding, IKeyKit, KeyData } from "@lindorm/types";
import { OkpError } from "../errors";
import { OkpKitOptions } from "../types";
import {
  assertOkpSignature,
  createOkpSignature,
  verifyOkpSignature,
} from "../utils/private";

export class OkpKit implements IKeyKit {
  private readonly dsa: DsaEncoding;
  private readonly encoding: BufferEncoding;
  private readonly kryptos: IKryptosOkp;

  public constructor(options: OkpKitOptions) {
    this.dsa = options.dsa ?? "der";
    this.encoding = options.encoding ?? "base64";

    if (!KryptosKit.isOkp(options.kryptos)) {
      throw new OkpError("Invalid Kryptos instance");
    }

    if (!OKP_SIG_CURVES.includes(options.kryptos.curve as OkpSigCurve)) {
      throw new OkpError("OkpKit only supports signing curves (Ed25519, Ed448)");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: KeyData): Buffer {
    return createOkpSignature({
      data,
      dsaEncoding: this.dsa,
      kryptos: this.kryptos,
    });
  }

  public verify(data: KeyData, signature: KeyData): boolean {
    return verifyOkpSignature({
      data,
      dsaEncoding: this.dsa,
      encoding: this.encoding,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: KeyData, signature: KeyData): void {
    return assertOkpSignature({
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
