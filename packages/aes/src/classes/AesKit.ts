import { isObject, isString } from "@lindorm/is";
import { IKryptos } from "@lindorm/kryptos";
import { BufferFormat, ShaAlgorithm } from "@lindorm/types";
import { AesError } from "../errors";
import {
  AesEncryption,
  AesEncryptionData,
  AesKitOptions,
  DecryptAesDataOptions,
} from "../types";
import {
  _assertAesCipher,
  _decryptAesCipher,
  _encryptAesCipher,
  _verifyAesCipher,
} from "../utils/private/aes-cipher";
import { _decryptAesData, _encryptAesData } from "../utils/private/aes-data";

export class AesKit {
  private readonly encryption: AesEncryption;
  private readonly format: BufferFormat;
  private readonly integrityHash: ShaAlgorithm;
  private readonly kryptos: IKryptos;

  public constructor(options: AesKitOptions) {
    this.encryption = options.encryption || "aes-256-gcm";
    this.format = options.format || "base64url";
    this.integrityHash = options.integrityHash || "SHA256";
    this.kryptos = options.kryptos;
  }

  public encrypt(cipher: string, mode?: "cipher"): string;
  public encrypt(data: string, mode: "object"): AesEncryptionData;
  public encrypt(
    arg: string,
    mode: "cipher" | "object" = "cipher",
  ): string | AesEncryptionData {
    switch (mode) {
      case "cipher":
        return _encryptAesCipher({
          data: arg,
          encryption: this.encryption,
          format: this.format,
          integrityHash: this.integrityHash,
          kryptos: this.kryptos,
        });

      case "object":
        return _encryptAesData({
          data: arg,
          encryption: this.encryption,
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
