import { CryptoError } from "../error";
import { CryptoLayeredOptions } from "../types";
import { CryptoAes } from "./CryptoAes";
import { CryptoArgon } from "./CryptoArgon";
import { CryptoHmac } from "./CryptoHmac";

export class CryptoLayered {
  private aes: CryptoAes;
  private argon: CryptoArgon;
  private hmac: CryptoHmac;

  public constructor(options: CryptoLayeredOptions) {
    this.aes = new CryptoAes(options.aes);
    this.argon = new CryptoArgon(options.argon);
    this.hmac = new CryptoHmac(options.hmac);
  }

  public async sign(data: string): Promise<string> {
    const hmac = this.hmac.sign(data);
    const argon = await this.argon.sign(hmac);
    return this.aes.encrypt(argon);
  }

  public async verify(data: string, signature: string): Promise<boolean> {
    const hmac = this.hmac.sign(data);
    const argon = this.aes.decrypt(signature);

    return this.argon.verify(hmac, argon);
  }

  public async assert(data: string, signature: string): Promise<void> {
    if (await this.verify(data, signature)) return;
    throw new CryptoError("Invalid Layered data");
  }
}
