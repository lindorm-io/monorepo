import { AES, enc } from "crypto-js";
import { CryptoError } from "../error";
import { CryptoAESOptions } from "../types";
import { stringComparison } from "@lindorm-io/core";

export class CryptoAES {
  private secret: string;

  public constructor(options: CryptoAESOptions) {
    this.secret = options.secret;
  }

  public encrypt(input: string): string {
    return AES.encrypt(input, this.secret).toString();
  }

  public decrypt(signature: string): string {
    return AES.decrypt(signature, this.secret).toString(enc.Utf8);
  }

  public verify(input: string, signature: string): boolean {
    return stringComparison(input, this.decrypt(signature));
  }

  public assert(input: string, signature: string): void {
    if (this.verify(input, signature)) {
      return;
    }

    throw new CryptoError("Invalid AES input");
  }
}
