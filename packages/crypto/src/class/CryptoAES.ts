import { AesCipherAlgorithm, AesCipherFormat, CryptoAesOptions } from "../types";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "../utils";

export class CryptoAes {
  private algorithm: AesCipherAlgorithm | undefined;
  private format: AesCipherFormat | undefined;
  private secret: string;

  public constructor(options: CryptoAesOptions) {
    this.algorithm = options.algorithm;
    this.format = options.format;
    this.secret = options.secret;
  }

  public encrypt(data: string): string {
    return encryptAesCipher({
      algorithm: this.algorithm,
      data,
      format: this.format,
      secret: this.secret,
    });
  }

  public decrypt(cipher: string): string {
    return decryptAesCipher({
      algorithm: this.algorithm,
      cipher,
      format: this.format,
      secret: this.secret,
    });
  }

  public verify(data: string, cipher: string): boolean {
    return verifyAesCipher({
      algorithm: this.algorithm,
      cipher,
      data,
      format: this.format,
      secret: this.secret,
    });
  }

  public assert(data: string, cipher: string): void {
    return assertAesCipher({
      algorithm: this.algorithm,
      cipher,
      data,
      format: this.format,
      secret: this.secret,
    });
  }
}
