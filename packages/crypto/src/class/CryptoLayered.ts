import { CryptoAES } from "./CryptoAES";
import { CryptoArgon } from "./CryptoArgon";
import { CryptoError } from "../error";
import { CryptoSHA } from "./CryptoSHA";
import { CryptoLayeredOptions } from "../types";
import { baseHash, baseParse } from "@lindorm-io/core";

export class CryptoLayered {
  private aes: CryptoAES;
  private argon: CryptoArgon;
  private sha: CryptoSHA;

  public constructor(options: CryptoLayeredOptions) {
    this.aes = new CryptoAES(options.aes);
    this.argon = new CryptoArgon(options.argon);
    this.sha = new CryptoSHA(options.sha);
  }

  public async encrypt(input: string): Promise<string> {
    const sha = this.sha.encrypt(input);
    const argon = await this.argon.encrypt(sha);
    const aes = this.aes.encrypt(argon);

    return baseHash(aes);
  }

  public async verify(input: string, signature: string): Promise<boolean> {
    const sha = this.sha.encrypt(input);
    const aes = baseParse(signature);
    const argon = this.aes.decrypt(aes);

    return this.argon.verify(sha, argon);
  }

  public async assert(input: string, signature: string): Promise<void> {
    if (await this.verify(input, signature)) return;

    throw new CryptoError("Invalid Layered input");
  }
}
