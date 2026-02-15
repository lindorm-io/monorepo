import { isEqual } from "@lindorm/is";
import { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../errors";
import { IAesKit } from "../interfaces";
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

  public encrypt(data: AesContent, mode?: "encoded"): string;
  public encrypt(data: AesContent, mode: "record"): AesEncryptionRecord;
  public encrypt(data: AesContent, mode: "serialised"): SerialisedAesEncryption;
  public encrypt(data: AesContent, mode: "tokenised"): string;
  public encrypt(
    data: AesContent,
    mode: AesEncryptionMode = "encoded",
  ): string | AesEncryptionRecord | SerialisedAesEncryption {
    switch (mode) {
      case "encoded":
        return createEncodedAesString(
          encryptAes({
            data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          }),
        );

      case "record":
        return encryptAes({
          data,
          encryption: this.encryption,
          kryptos: this.kryptos,
        });

      case "serialised":
        return createSerialisedAesRecord(
          encryptAes({
            data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          }),
        );

      case "tokenised":
        return createTokenisedAesString(
          encryptAes({
            data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          }),
        );

      default:
        throw new AesError("Invalid encryption mode");
    }
  }

  public decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): T {
    return decryptAes<T>({ ...parseAes(data), kryptos: this.kryptos });
  }

  public verify(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): boolean {
    try {
      return isEqual(input, this.decrypt(data));
    } catch {
      return false;
    }
  }

  public assert(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): void {
    if (this.verify(input, data)) return;
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
