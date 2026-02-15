import { isEqual } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../errors";
import { AesOperationOptions, IAesKit } from "../interfaces";
import {
  AesContent,
  AesContentType,
  AesDecryptionRecord,
  AesEncryptionMode,
  AesEncryptionRecord,
  AesKitOptions,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types";
import { isAesTokenised, parseAes } from "../utils";
import {
  createEncodedAesString,
  createSerialisedAesRecord,
  createTokenisedAesString,
  decryptAes,
  encryptAes,
} from "../utils/private";
import { calculateContentType } from "../utils/private/content";

export class AesKit implements IAesKit {
  private readonly encryption: KryptosEncryption;
  public readonly kryptos: IKryptos;

  public constructor(options: AesKitOptions) {
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
  }

  public encrypt(
    data: AesContent,
    mode?: "encoded",
    options?: AesOperationOptions,
  ): string;
  public encrypt(
    data: AesContent,
    mode: "record",
    options?: AesOperationOptions,
  ): AesEncryptionRecord;
  public encrypt(
    data: AesContent,
    mode: "serialised",
    options?: AesOperationOptions,
  ): SerialisedAesEncryption;
  public encrypt(
    data: AesContent,
    mode: "tokenised",
    options?: AesOperationOptions,
  ): string;
  public encrypt(
    data: AesContent,
    mode: AesEncryptionMode = "encoded",
    options?: AesOperationOptions,
  ): string | AesEncryptionRecord | SerialisedAesEncryption {
    const encryptionOptions = {
      aad: options?.aad,
      data,
      encryption: this.encryption,
      kryptos: this.kryptos,
    };

    switch (mode) {
      case "encoded":
        return createEncodedAesString(encryptAes(encryptionOptions));

      case "record":
        return encryptAes(encryptionOptions);

      case "serialised":
        return createSerialisedAesRecord(encryptAes(encryptionOptions));

      case "tokenised":
        return createTokenisedAesString(encryptAes(encryptionOptions));

      default:
        throw new AesError("Invalid encryption mode");
    }
  }

  public decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): T {
    return decryptAes<T>({ ...parseAes(data), aad: options?.aad, kryptos: this.kryptos });
  }

  public verify(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): boolean {
    try {
      return isEqual(input, this.decrypt(data, options));
    } catch {
      return false;
    }
  }

  public assert(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): void {
    if (this.verify(input, data, options)) return;
    throw new AesError("Invalid AES cipher");
  }

  // public static

  public static contentType(input: any): AesContentType {
    return calculateContentType(input);
  }

  public static isAesTokenised(input: any): input is string {
    return isAesTokenised(input);
  }

  public static parse(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): AesDecryptionRecord {
    return parseAes(data);
  }
}
