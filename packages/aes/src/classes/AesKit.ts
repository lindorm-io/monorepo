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
import { PreparedEncryption } from "../types/private";
import { isAesTokenised, parseAes } from "../utils";
import { decryptAes, encryptAes, prepareAesEncryption } from "../utils/private";
import { calculateContentType } from "../utils/private/content";
import { encryptEncoded } from "../utils/private/encrypt-encoded";
import { encryptSerialised } from "../utils/private/encrypt-serialised";
import { encryptTokenised } from "../utils/private/encrypt-tokenised";

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
    _options?: AesOperationOptions,
  ): string | AesEncryptionRecord | SerialisedAesEncryption {
    try {
      switch (mode) {
        case "encoded":
          return encryptEncoded({
            data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          });

        case "record":
          return encryptAes({
            data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          });

        case "serialised":
          return encryptSerialised({
            data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          });

        case "tokenised":
          return encryptTokenised({
            data,
            encryption: this.encryption,
            kryptos: this.kryptos,
          });

        default:
          throw new AesError("Invalid encryption mode");
      }
    } catch (error) {
      if (error instanceof AesError) throw error;
      throw new AesError("AES encryption failed", { error: error as Error });
    }
  }

  public decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): T {
    try {
      const parsed = parseAes(data);

      // For string formats and serialised records, the AAD comes from the parsed header.
      // For raw record mode, the caller may provide AAD via options.
      // If the parsed data already has AAD (from format parsing), use it.
      // If the caller provides AAD (raw record mode), use that instead.
      const aad = parsed.aad ?? options?.aad;

      return decryptAes<T>({
        ...parsed,
        aad,
        kryptos: this.kryptos,
      });
    } catch (error) {
      if (error instanceof AesError) throw error;
      throw new AesError("AES decryption failed", { error: error as Error });
    }
  }

  public verify(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): boolean {
    try {
      return isEqual(input, this.decrypt(data, options));
    } catch (_error) {
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

  public prepareEncryption(): PreparedEncryption {
    try {
      return prepareAesEncryption({ encryption: this.encryption, kryptos: this.kryptos });
    } catch (error) {
      if (error instanceof AesError) throw error;
      throw new AesError("AES prepare encryption failed", { error: error as Error });
    }
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
