import { AkpKit } from "@lindorm/akp";
import { EcKit } from "@lindorm/ec";
import { OctKit } from "@lindorm/oct";
import { OkpKit } from "@lindorm/okp";
import { RsaKit } from "@lindorm/rsa";
import type { IKeyKit, KeyData } from "@lindorm/types";
import { AegisError } from "../errors/index.js";
import type { SignatureOptions } from "../types/index.js";

export class SignatureKit implements IKeyKit {
  private readonly kit: IKeyKit;

  constructor(options: SignatureOptions) {
    this.kit = this.getKit(options);
  }

  // public

  sign(data: KeyData): Buffer {
    return this.kit.sign(data);
  }

  verify(data: KeyData, signature: KeyData): boolean {
    return this.kit.verify(data, signature);
  }

  assert(data: KeyData, signature: KeyData): void {
    return this.kit.assert(data, signature);
  }

  format(data: Buffer): string {
    return this.kit.format(data);
  }

  // private

  private getKit(options: SignatureOptions): IKeyKit {
    switch (options.kryptos.type) {
      case "AKP":
        return new AkpKit(options);

      case "EC":
        return new EcKit(options);

      case "RSA":
        return new RsaKit(options);

      case "OKP":
        return new OkpKit(options);

      case "oct":
        return new OctKit(options);

      default:
        throw new AegisError("Unsupported kryptos type", {
          code: "unsupported_kryptos_type",
          title: "Unsupported Kryptos Type",
          details:
            "The kryptos key type is not one of AKP, EC, RSA, OKP, or oct, so no signature kit can be selected.",
        });
    }
  }
}
