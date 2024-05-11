import { Kryptos } from "@lindorm/kryptos";
import {
  AesCipherOptions,
  BufferFormat,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
} from "../types";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "../utils";

export class AesCipher {
  private readonly encryption: Encryption;
  private readonly encryptionKeyAlgorithm: EncryptionKeyAlgorithm;
  private readonly format: BufferFormat;
  private readonly integrityHash: IntegrityHash;
  private readonly kryptos: Kryptos;

  public constructor(options: AesCipherOptions) {
    this.encryption = options.encryption || "aes-256-gcm";
    this.encryptionKeyAlgorithm = options.encryptionKeyAlgorithm || "RSA-OAEP-256";
    this.format = options.format || "base64url";
    this.integrityHash = options.integrityHash || "sha256";
    this.kryptos = options.kryptos;
  }

  public encrypt(data: string): string {
    return encryptAesCipher({
      encryption: this.encryption,
      data,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      format: this.format,
      integrityHash: this.integrityHash,
      kryptos: this.kryptos,
    });
  }

  public decrypt(cipher: string): string {
    return decryptAesCipher({
      cipher,
      kryptos: this.kryptos,
    });
  }

  public verify(data: string, cipher: string): boolean {
    return verifyAesCipher({
      cipher,
      data,
      kryptos: this.kryptos,
    });
  }

  public assert(data: string, cipher: string): void {
    return assertAesCipher({
      cipher,
      data,
      kryptos: this.kryptos,
    });
  }
}
