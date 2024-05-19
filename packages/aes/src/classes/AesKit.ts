import { isObject, isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { AesError } from "../errors";
import { AesEncryptionData, AesKitOptions, DecryptAesDataOptions } from "../types";
import {
  _assertAesCipher,
  _decryptAesCipher,
  _encryptAesCipher,
  _verifyAesCipher,
} from "../utils/private/aes-cipher";
import { _decryptAesData, _encryptAesData } from "../utils/private/aes-data";

export class AesKit {
  private readonly encryption: KryptosEncryption;
  private readonly format: BufferFormat;
  private readonly kryptos: IKryptos;

  public constructor(options: AesKitOptions) {
    this.encryption = options.encryption || "A256GCM";
    this.format = options.format || "base64url";
    this.kryptos = options.kryptos;
  }

  public encrypt(data: string, mode?: "cipher"): string;
  public encrypt(data: string, mode: "object"): AesEncryptionData;
  public encrypt(
    data: string,
    mode: "cipher" | "object" = "cipher",
  ): string | AesEncryptionData {
    switch (mode) {
      case "cipher":
        return _encryptAesCipher({
          data: data,
          encryption: this.encryption,
          format: this.format,
          kryptos: this.kryptos,
        });

      case "object":
        return _encryptAesData({
          data: data,
          encryption: this.encryption,
          format: this.format,
          kryptos: this.kryptos,
        });

      default:
        throw new AesError("Invalid encryption mode");
    }
  }

  public decrypt(data: string): string;
  public decrypt(data: Omit<DecryptAesDataOptions, "kryptos">): string;
  public decrypt(data: Omit<DecryptAesDataOptions, "kryptos"> | string): string {
    if (isString(data)) {
      return _decryptAesCipher({
        cipher: data,
        kryptos: this.kryptos,
      });
    }

    if (isObject(data)) {
      return _decryptAesData({
        ...data,
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
