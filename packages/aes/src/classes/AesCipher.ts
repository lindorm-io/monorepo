import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { AesCipherOptions, AesEncryptionKey } from "../types";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "../utils";

export class AesCipher {
  private readonly algorithm: AesAlgorithm;
  private readonly encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm;
  private readonly format: AesFormat;
  private readonly key: AesEncryptionKey | undefined;
  private readonly secret: string | undefined;

  public constructor(options: AesCipherOptions) {
    this.algorithm = options.algorithm || AesAlgorithm.AES_256_GCM;
    this.encryptionKeyAlgorithm =
      options.encryptionKeyAlgorithm || AesEncryptionKeyAlgorithm.RSA_OAEP_256;
    this.format = options.format || AesFormat.BASE64_URL;
    this.key = options.key;
    this.secret = options.secret;
  }

  public encrypt(data: string): string {
    return encryptAesCipher({
      algorithm: this.algorithm,
      data,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
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
