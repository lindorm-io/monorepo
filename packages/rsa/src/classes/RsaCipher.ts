import { RsaFormat } from "../enums";
import { RsaError } from "../errors";
import { RsaCipherOptions, RsaPrivateKey, RsaPublicKey } from "../types";
import { assertRsaCipher, decryptRsaCipher, encryptRsaCipher, verifyRsaCipher } from "../utils";

export class RsaCipher {
  private readonly format: RsaFormat;
  private readonly publicKey: RsaPublicKey | undefined;
  private readonly privateKey: RsaPrivateKey | undefined;

  public constructor(options: RsaCipherOptions) {
    this.format = options.format || RsaFormat.BASE64;
    this.publicKey = options.publicKey;
    this.privateKey = options.privateKey;
  }

  public encrypt(data: string): string {
    const key = this.privateKey || this.publicKey;

    if (!key) {
      throw new RsaError("Missing public or private key");
    }

    return encryptRsaCipher({ data, format: this.format, key });
  }

  public decrypt(cipher: string): string {
    const key = this.publicKey || this.privateKey;

    if (!key) {
      throw new RsaError("Missing public or private key");
    }

    return decryptRsaCipher({ cipher, format: this.format, key });
  }

  public verify(data: string, cipher: string): boolean {
    const key = this.publicKey || this.privateKey;

    if (!key) {
      throw new RsaError("Missing public or private key");
    }

    return verifyRsaCipher({ cipher, data, format: this.format, key });
  }

  public assert(data: string, cipher: string): void {
    const key = this.publicKey || this.privateKey;

    if (!key) {
      throw new RsaError("Missing public or private key");
    }

    assertRsaCipher({ cipher, data, format: this.format, key });
  }
}
