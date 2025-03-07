import { IKryptosEc, KryptosKit } from "@lindorm/kryptos";
import { EcError } from "../errors";
import { EcKitOptions, EcSignatureFormat } from "../types";
import {
  assertEcSignature,
  createEcSignature,
  verifyEcSignature,
} from "../utils/private";

export class EcKit {
  private readonly format: EcSignatureFormat;
  private readonly kryptos: IKryptosEc;

  public constructor(options: EcKitOptions) {
    this.format = options.format ?? "base64";

    if (!KryptosKit.isEc(options.kryptos)) {
      throw new EcError("Invalid Kryptos instance");
    }

    this.kryptos = options.kryptos;
  }

  public sign(data: string): string {
    return createEcSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, signature: string): boolean {
    return verifyEcSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }

  public assert(data: string, signature: string): void {
    return assertEcSignature({
      data,
      format: this.format,
      kryptos: this.kryptos,
      signature,
    });
  }
}
