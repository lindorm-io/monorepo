import { isObject, isString } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../errors";
import { IAesKit } from "../interfaces";
import {
  AesDecryptionRecord,
  AesEncryptionMode,
  AesEncryptionRecord,
  AesKitOptions,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types";
import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "../utils";
import {
  createEncodedAesString,
  createSerialisedAesRecord,
  createTokenisedAesString,
  decryptAes,
  encryptAes,
  parseEncodedAesString,
  parseSerialisedAesRecord,
  parseTokenisedAesString,
} from "../utils/private";

export class AesKit implements IAesKit {
  private readonly encryption: KryptosEncryption;
  public readonly kryptos: IKryptos;

  public constructor(options: AesKitOptions) {
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
  }

  public encrypt(data: string, mode?: "encoded"): string;
  public encrypt(data: string, mode: "record"): AesEncryptionRecord;
  public encrypt(data: string, mode: "serialised"): SerialisedAesEncryption;
  public encrypt(data: string, mode: "tokenised"): string;
  public encrypt(
    data: string,
    mode: AesEncryptionMode = "encoded",
  ): string | AesEncryptionRecord | SerialisedAesEncryption {
    switch (mode) {
      case "encoded":
        return createEncodedAesString(
          encryptAes({
            data: data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          }),
        );

      case "record":
        return encryptAes({
          data: data,
          encryption: this.encryption,
          kryptos: this.kryptos,
        });

      case "serialised":
        return createSerialisedAesRecord(
          encryptAes({
            data: data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          }),
        );

      case "tokenised":
        return createTokenisedAesString(
          encryptAes({
            data: data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          }),
        );

      default:
        throw new AesError("Invalid encryption mode");
    }
  }

  public decrypt(data: AesDecryptionRecord | SerialisedAesDecryption | string): string {
    if (isString(data) && !isAesTokenised(data)) {
      return decryptAes({
        ...parseEncodedAesString(data),
        kryptos: this.kryptos,
      });
    }

    if (isString(data) && isAesTokenised(data)) {
      return decryptAes({
        ...parseTokenisedAesString(data),
        kryptos: this.kryptos,
      });
    }

    if (isObject(data) && isAesBufferData(data)) {
      return decryptAes({
        ...data,
        kryptos: this.kryptos,
      });
    }

    if (isObject(data) && isAesSerialisedData(data)) {
      return decryptAes({
        ...parseSerialisedAesRecord(data),
        kryptos: this.kryptos,
      });
    }

    throw new AesError("Invalid decryption type");
  }

  public verify(
    input: string,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): boolean {
    return this.decrypt(data) === input;
  }

  public assert(
    input: string,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): void {
    if (this.verify(input, data)) return;
    throw new AesError("Invalid AES cipher");
  }

  // public static

  public static isAesTokenised(input: any): input is string {
    return isAesTokenised(input);
  }
}
