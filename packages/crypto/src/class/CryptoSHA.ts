import { CryptoError } from "../error";
import { HmacSHA512 } from "crypto-js";
import { CryptoSHAOptions } from "../types";
import { stringComparison } from "@lindorm-io/core";

export class CryptoSHA {
  private secret: string;

  public constructor(options: CryptoSHAOptions) {
    this.secret = options.secret;
  }

  public encrypt(input: string): string {
    return HmacSHA512(input, this.secret).toString();
  }

  public verify(input: string, signature: string): boolean {
    return stringComparison(this.encrypt(input), signature);
  }

  public assert(input: string, signature: string): void {
    if (this.verify(input, signature)) {
      return;
    }

    throw new CryptoError("Invalid SHA input");
  }
}
