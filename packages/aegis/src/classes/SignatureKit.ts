import { EcKit } from "@lindorm/ec";
import { OctKit } from "@lindorm/oct";
import { OkpKit } from "@lindorm/okp";
import { RsaKit } from "@lindorm/rsa";
import { IKeyKit, KeyData } from "@lindorm/types";
import { AegisError } from "../errors";
import { SignatureOptions } from "../types";

export class SignatureKit implements IKeyKit {
  private readonly kit: IKeyKit;

  public constructor(options: SignatureOptions) {
    this.kit = this.getKit(options);
  }

  // public

  public sign(data: KeyData): Buffer {
    return this.kit.sign(data);
  }

  public verify(data: KeyData, signature: KeyData): boolean {
    return this.kit.verify(data, signature);
  }

  public assert(data: KeyData, signature: KeyData): void {
    return this.kit.assert(data, signature);
  }

  public format(data: Buffer): string {
    return this.kit.format(data);
  }

  // private

  private getKit(options: SignatureOptions): IKeyKit {
    switch (options.kryptos.type) {
      case "EC":
        return new EcKit(options);

      case "RSA":
        return new RsaKit(options);

      case "OKP":
        return new OkpKit(options);

      case "oct":
        return new OctKit(options);

      default:
        throw new AegisError("Unsupported kryptos type");
    }
  }
}
