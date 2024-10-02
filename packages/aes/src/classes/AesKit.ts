import { isObject, isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../errors";
import { IAesKit } from "../interfaces";
import {
  AesEncryptionData,
  AesEncryptionDataEncoded,
  AesKitOptions,
  DecryptAesDataEncodedOptions,
  DecryptAesDataOptions,
} from "../types";
import {
  assertAesCipher,
  decryptAesCipher,
  encryptAesCipher,
  verifyAesCipher,
} from "../utils/private/aes-cipher";
import { decryptAesData, encryptAesData } from "../utils/private/aes-data";
import { decodeAesDataOptions } from "../utils/private/decode-aes-data";
import { encodeAesData } from "../utils/private/encode-aes-data";

export class AesKit implements IAesKit {
  private readonly encryption: KryptosEncryption;
  public readonly kryptos: IKryptos;

  public constructor(options: AesKitOptions) {
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
  }

  public encrypt(data: string, mode?: "cipher"): string;
  public encrypt(data: string, mode: "b64"): AesEncryptionDataEncoded;
  public encrypt(data: string, mode: "object"): AesEncryptionData;
  public encrypt(
    data: string,
    mode: "b64" | "cipher" | "object" = "cipher",
  ): string | AesEncryptionData | AesEncryptionDataEncoded {
    switch (mode) {
      case "b64":
        return encodeAesData(
          encryptAesData({ data, encryption: this.encryption, kryptos: this.kryptos }),
        );

      case "cipher":
        return encryptAesCipher({
          data: data,
          encryption: this.encryption,
          kryptos: this.kryptos,
        });

      case "object":
        return encryptAesData({
          data: data,
          encryption: this.encryption,
          kryptos: this.kryptos,
        });

      default:
        throw new AesError("Invalid encryption mode");
    }
  }

  public decrypt(data: string): string;
  public decrypt(data: Omit<DecryptAesDataOptions, "kryptos">): string;
  public decrypt(data: Omit<DecryptAesDataEncodedOptions, "kryptos">): string;
  public decrypt(
    data:
      | Omit<DecryptAesDataOptions, "kryptos">
      | Omit<DecryptAesDataEncodedOptions, "kryptos">
      | string,
  ): string {
    if (isString(data)) {
      return decryptAesCipher({
        cipher: data,
        kryptos: this.kryptos,
      });
    }

    if (isObject(data)) {
      return decryptAesData({
        ...decodeAesDataOptions(data),
        kryptos: this.kryptos,
      });
    }

    throw new AesError("Invalid decryption type");
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
