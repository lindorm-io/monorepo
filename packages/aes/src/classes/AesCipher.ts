import { AesAlgorithm, AesFormat } from "../enums";
import { AesCipherKey, AesCipherOptions } from "../types";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "../utils";

export class AesCipher {
  private readonly algorithm: AesAlgorithm;
  private readonly format: AesFormat;
  private readonly key: AesCipherKey | undefined;
  private readonly secret: string | undefined;

  public constructor(options: AesCipherOptions) {
    this.algorithm = options.algorithm || AesAlgorithm.AES_256_GCM;
    this.format = options.format || AesFormat.BASE64;
    this.key = options.key;
    this.secret = options.secret;
  }

  public encrypt(data: string): string {
    return encryptAesCipher({
      algorithm: this.algorithm,
      data,
      format: this.format,
      key: this.key,
      secret: this.secret,
    });
  }

  public decrypt(cipher: string): string {
    return decryptAesCipher({
      cipher,
      key: this.key,
      secret: this.secret,
    });
  }

  public verify(data: string, cipher: string): boolean {
    return verifyAesCipher({
      cipher,
      data,
      key: this.key,
      secret: this.secret,
    });
  }

  public assert(data: string, cipher: string): void {
    return assertAesCipher({
      cipher,
      data,
      key: this.key,
      secret: this.secret,
    });
  }
}
