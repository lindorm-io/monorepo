import { isObject, isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../errors";
import { AesEncryptionData, AesKitOptions, DecryptAesDataOptions } from "../types";
import {
  assertAesCipher,
  decryptAesCipher,
  encryptAesCipher,
  verifyAesCipher,
} from "../utils/private/aes-cipher";
import { decryptAesData, encryptAesData } from "../utils/private/aes-data";

export class AesKit {
  private readonly encryption: KryptosEncryption;
  private readonly kryptos: IKryptos;

  public constructor(options: AesKitOptions) {
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
  }

  public encrypt(data: string, mode?: "cipher"): string;
  public encrypt(data: string, mode: "object"): AesEncryptionData;
  public encrypt(
    data: string,
    mode: "cipher" | "object" = "cipher",
  ): string | AesEncryptionData {
    switch (mode) {
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
  public decrypt(data: Omit<DecryptAesDataOptions, "kryptos"> | string): string {
    if (isString(data)) {
      return decryptAesCipher({
        cipher: data,
        kryptos: this.kryptos,
      });
    }

    if (isObject(data)) {
      return decryptAesData({
        ...data,
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
