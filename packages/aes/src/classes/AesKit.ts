import { isObject, isString } from "@lindorm/is";
import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../errors";
import {
  AesCipherOptions,
  AesEncryptionData,
  BufferFormat,
  DecryptAesDataOptions,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
} from "../types";
import {
  _assertAesCipher,
  _decryptAesCipher,
  _encryptAesCipher,
  _verifyAesCipher,
} from "../utils/private/aes-cipher";
import { _decryptAesData, _encryptAesData } from "../utils/private/aes-data";

export class AesKit {
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

  public encrypt(cipher: string, mode?: "cipher"): string;
  public encrypt(data: string, mode: "object"): AesEncryptionData;
  public encrypt(arg: string, mode: "cipher" | "object" = "cipher"): string | AesEncryptionData {
    switch (mode) {
      case "cipher":
        return _encryptAesCipher({
          data: arg,
          encryption: this.encryption,
          encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
          format: this.format,
          integrityHash: this.integrityHash,
          kryptos: this.kryptos,
        });

      case "object":
        return _encryptAesData({
          data: arg,
          encryption: this.encryption,
          encryptionKeyAlgorithm: this.encryptionKeyAlgorithm,
          format: this.format,
          integrityHash: this.integrityHash,
          kryptos: this.kryptos,
        });

      default:
        throw new AesError("Invalid encryption mode");
    }
  }

  public decrypt(cipher: string): string;
  public decrypt(data: Omit<DecryptAesDataOptions, "kryptos">): string;
  public decrypt(arg: Omit<DecryptAesDataOptions, "kryptos"> | string): string {
    if (isString(arg)) {
      return _decryptAesCipher({
        cipher: arg,
        kryptos: this.kryptos,
      });
    }

    if (isObject(arg)) {
      return _decryptAesData({
        ...arg,
        kryptos: this.kryptos,
      });
    }

    throw new AesError("Invalid decryption type");
  }

  public verify(data: string, cipher: string): boolean {
    return _verifyAesCipher({
      cipher,
      data,
      kryptos: this.kryptos,
    });
  }

  public assert(data: string, cipher: string): void {
    return _assertAesCipher({
      cipher,
      data,
      kryptos: this.kryptos,
    });
  }
}
