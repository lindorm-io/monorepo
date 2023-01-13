import { AES, enc } from "crypto-js";
import { CryptoAESOptions } from "../types";
import { CryptoError } from "../error";

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
    return input === this.decrypt(signature);
  }

  public assert(input: string, signature: string): void {
    if (this.verify(input, signature)) return;

    throw new CryptoError("Invalid AES input");
  }
}
