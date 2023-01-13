import { CryptoError } from "../error";
import { CryptoSHAOptions, Hmac } from "../types";
import { HmacSHA256, HmacSHA384, HmacSHA512 } from "crypto-js";

export class CryptoSHA {
  private readonly hmac: Hmac;
  private readonly secret: string;

  public constructor(options: CryptoSHAOptions) {
    this.hmac = options.hmac || "SHA256";
    this.secret = options.secret;
  }

  public encrypt(input: string): string {
    return this.hash(input);
  }

  public verify(input: string, signature: string): boolean {
    return this.encrypt(input) === signature;
  }

  public assert(input: string, signature: string): void {
    if (this.verify(input, signature)) return;

    throw new CryptoError("Invalid SHA input");
  }

  private hash(input: string): string {
    switch (this.hmac) {
      case "SHA256":
        return HmacSHA256(input, this.secret).toString();

      case "SHA384":
        return HmacSHA384(input, this.secret).toString();

      case "SHA512":
        return HmacSHA512(input, this.secret).toString();

      default:
        throw new CryptoError("Invalid HMAC");
    }
  }
}
