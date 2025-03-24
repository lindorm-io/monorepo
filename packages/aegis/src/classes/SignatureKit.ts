import { EcKit } from "@lindorm/ec";
import { OctKit } from "@lindorm/oct";
import { OkpKit } from "@lindorm/okp";
import { RsaKit } from "@lindorm/rsa";
import { IKeyKit } from "@lindorm/types";
import { SignatureOptions } from "../types";

export class SignatureKit implements IKeyKit {
  private readonly kit: IKeyKit;

  public constructor(options: SignatureOptions) {
    this.kit = this.getKit(options);
  }

  // public

  public sign(data: string): string {
    return this.kit.sign(data);
  }

  public verify(data: string, signature: string): boolean {
    return this.kit.verify(data, signature);
  }

  public assert(data: string, signature: string): void {
    return this.kit.assert(data, signature);
  }

  // private

  private getKit(options: SignatureOptions): IKeyKit {
    switch (options.kryptos.type) {
      case "EC":
        return new EcKit({ kryptos: options.kryptos, format: options.format });

      case "RSA":
        if (options.format === "raw") {
          throw new Error("Unsupported format");
        }
        return new RsaKit({ kryptos: options.kryptos, format: options.format });

      case "OKP":
        if (options.format === "raw") {
          throw new Error("Unsupported format");
        }
        return new OkpKit({ kryptos: options.kryptos, format: options.format });

      case "oct":
        if (options.format === "raw") {
          throw new Error("Unsupported format");
        }
        return new OctKit({ kryptos: options.kryptos, format: options.format });

      default:
        throw new Error("Unsupported kryptos type");
    }
  }
}
