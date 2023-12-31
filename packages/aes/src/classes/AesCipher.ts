import { KeySet } from "@lindorm-io/jwk";
import {
  AesCipherOptions,
  BufferFormat,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
  KeyObject,
  Secret,
} from "../types";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "../utils";

export class AesCipher {
  private readonly encryption: Encryption;
  private readonly encryptionKeyAlgorithm: EncryptionKeyAlgorithm;
  private readonly format: BufferFormat;
  private readonly integrityHash: IntegrityHash;
  private readonly key: KeyObject | undefined;
  private readonly keySet: KeySet | undefined;
  private readonly secret: Secret | undefined;

  public constructor(options: AesCipherOptions) {
    this.encryption = options.encryption || "aes-256-gcm";
    this.encryptionKeyAlgorithm = options.encryptionKeyAlgorithm || "RSA-OAEP-256";
    this.format = options.format || "base64url";
    this.integrityHash = options.integrityHash || "sha256";
    this.key = options.key;
    this.keySet = options.keySet;
    this.secret = options.secret;
  }

  public encrypt(data: string): string {
    return encryptAesCipher({
      encryption: this.encryption,
      data,
      encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
      format: this.format,
      integrityHash: this.integrityHash,
      key: this.key,
      keySet: this.keySet,
      secret: this.secret,
    });
  }

  public decrypt(cipher: string): string {
    return decryptAesCipher({
      cipher,
      key: this.key,
      keySet: this.keySet,
      secret: this.secret,
    });
  }

  public verify(data: string, cipher: string): boolean {
    return verifyAesCipher({
      cipher,
      data,
      key: this.key,
      keySet: this.keySet,
      secret: this.secret,
    });
  }

  public assert(data: string, cipher: string): void {
    return assertAesCipher({
      cipher,
      data,
      key: this.key,
      keySet: this.keySet,
      secret: this.secret,
    });
  }
}
