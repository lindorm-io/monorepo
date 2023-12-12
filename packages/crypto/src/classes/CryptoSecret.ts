import { AesCipher } from "@lindorm-io/aes";
import { CryptoError } from "../errors";
import { CryptoSecretOptions } from "../types";
import { CryptoHmac } from "./CryptoHmac";

export class CryptoSecret {
  private aes: AesCipher;
  private hmac: CryptoHmac;

  public constructor(options: CryptoSecretOptions) {
    this.aes = new AesCipher(options.aes);
    this.hmac = new CryptoHmac(options.hmac);
  }

  public sign(data: string): string {
    const hmac = this.hmac.sign(data);
    return this.aes.encrypt(hmac);
  }

  public verify(data: string, signature: string): boolean {
    const hmac = this.hmac.sign(data);
    const hash = this.aes.decrypt(signature);
    return hmac === hash;
  }

  public assert(data: string, signature: string): void {
    if (this.verify(data, signature)) return;
    throw new CryptoError("Invalid Secret data");
  }
}
