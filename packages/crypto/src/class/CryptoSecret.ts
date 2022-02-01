import { CryptoAES } from "./CryptoAES";
import { CryptoError } from "../error";
import { CryptoSHA } from "./CryptoSHA";
import { CryptoSecretOptions } from "../types";
import { baseHash, baseParse, stringComparison } from "@lindorm-io/core";

export class CryptoSecret {
  private aes: CryptoAES;
  private sha: CryptoSHA;

  public constructor(options: CryptoSecretOptions) {
    this.aes = new CryptoAES(options.aes);
    this.sha = new CryptoSHA(options.sha);
  }

  public encrypt(input: string): string {
    const sha = this.sha.encrypt(input);
    const aes = this.aes.encrypt(sha);

    return baseHash(aes);
  }

  public verify(input: string, signature: string): boolean {
    const sha = this.sha.encrypt(input);
    const aes = baseParse(signature);
    const hash = this.aes.decrypt(aes);

    return stringComparison(sha, hash);
  }

  public assert(input: string, signature: string): void {
    if (this.verify(input, signature)) {
      return;
    }

    throw new CryptoError("Invalid Secret input");
  }
}
