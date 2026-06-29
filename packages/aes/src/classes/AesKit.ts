import { isEqual } from "@lindorm/is";
import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../errors/index.js";
import type {
  AesContentDecryption,
  AesContentEncryption,
  AesContentOptions,
  AesOperationOptions,
  IAesKit,
} from "../interfaces/index.js";
import type {
  AesContent,
  AesContentType,
  AesDecryptionRecord,
  AesEncryptionMode,
  AesEncryptionRecord,
  AesKitOptions,
  ParsedAesDecryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types/index.js";
import type { PreparedEncryption } from "../internal/types/prepared-encryption.js";
import { isAesTokenised, parseAes } from "../utils/index.js";
import { decryptAes, encryptAes } from "../internal/utils/encryption.js";
import {
  decryptContentDirect,
  encryptContentDirect,
} from "../internal/utils/content-primitive.js";
import { prepareAesEncryption } from "../internal/utils/prepare-encryption.js";
import { calculateContentType } from "../internal/utils/content.js";
import { encryptEncoded } from "../internal/utils/encrypt-encoded.js";
import { encryptSerialised } from "../internal/utils/encrypt-serialised.js";
import { encryptTokenised } from "../internal/utils/encrypt-tokenised.js";

export class AesKit implements IAesKit {
  private readonly encryption: KryptosEncryption;
  readonly kryptos: IKryptos;

  constructor(options: AesKitOptions) {
    this.kryptos = options.kryptos;
    this.encryption = options.encryption ?? options.kryptos.encryption ?? "A256GCM";
  }

  encrypt(data: AesContent, mode?: "encoded", options?: AesOperationOptions): string;
  encrypt(
    data: AesContent,
    mode: "record",
    options?: AesOperationOptions,
  ): AesEncryptionRecord;
  encrypt(
    data: AesContent,
    mode: "serialised",
    options?: AesOperationOptions,
  ): SerialisedAesEncryption;
  encrypt(data: AesContent, mode: "tokenised", options?: AesOperationOptions): string;
  encrypt(
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
          throw new AesError("Invalid encryption mode", {
            code: "invalid_encryption_mode",
            title: "Invalid Encryption Mode",
            details:
              "The requested AES encryption mode is not one of the supported output modes (encoded, serialised, or tokenised).",
          });
      }
    } catch (error) {
      if (error instanceof AesError) throw error;
      throw new AesError("AES encryption failed", {
        code: "encryption_failed",
        title: "Encryption Failed",
        details:
          "The AES encryption operation failed unexpectedly; see the underlying error for the root cause.",
        error: error as Error,
      });
    }
  }

  decrypt<T extends AesContent = string>(
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
      throw new AesError("AES decryption failed", {
        code: "decryption_failed",
        title: "Decryption Failed",
        details:
          "The AES decryption operation failed unexpectedly; see the underlying error for the root cause.",
        error: error as Error,
      });
    }
  }

  verify(
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

  assert(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): void {
    if (this.verify(input, data, options)) return;
    throw new AesError("Invalid AES cipher", {
      code: "invalid_cipher",
      title: "Invalid AES Cipher",
      details:
        "The decrypted AES content did not match the expected input value during assertion.",
    });
  }

  encryptContent(content: Buffer, options?: AesContentOptions): AesContentEncryption {
    try {
      return encryptContentDirect({
        aad: options?.aad,
        content,
        encryption: this.encryption,
        initialisationVector: options?.iv,
        kryptos: this.kryptos,
      });
    } catch (error) {
      if (error instanceof AesError) throw error;
      throw new AesError("AES content encryption failed", {
        code: "encryption_failed",
        title: "Encryption Failed",
        details:
          "The AES content-encryption primitive failed unexpectedly; see the underlying error for the root cause.",
        error: error as Error,
      });
    }
  }

  decryptContent(input: AesContentDecryption): Buffer {
    try {
      return decryptContentDirect({
        aad: input.aad,
        ciphertext: input.ciphertext,
        encryption: this.encryption,
        initialisationVector: input.iv,
        kryptos: this.kryptos,
        tag: input.tag,
      });
    } catch (error) {
      if (error instanceof AesError) throw error;
      throw new AesError("AES content decryption failed", {
        code: "decryption_failed",
        title: "Decryption Failed",
        details:
          "The AES content-decryption primitive failed unexpectedly; see the underlying error for the root cause.",
        error: error as Error,
      });
    }
  }

  prepareEncryption(): PreparedEncryption {
    try {
      return prepareAesEncryption({ encryption: this.encryption, kryptos: this.kryptos });
    } catch (error) {
      if (error instanceof AesError) throw error;
      throw new AesError("AES prepare encryption failed", {
        code: "prepare_encryption_failed",
        title: "Prepare Encryption Failed",
        details:
          "Deriving the content encryption key and parameters ahead of AES encryption failed; see the underlying error for the root cause.",
        error: error as Error,
      });
    }
  }

  // public static

  static contentType(input: any): AesContentType {
    return calculateContentType(input);
  }

  static isAesTokenised(input: any): input is string {
    return isAesTokenised(input);
  }

  static parse(data: string): ParsedAesDecryptionRecord;
  static parse(data: SerialisedAesDecryption): ParsedAesDecryptionRecord;
  static parse(data: AesDecryptionRecord): AesDecryptionRecord;
  static parse(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): AesDecryptionRecord;
  static parse(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
  ): AesDecryptionRecord {
    return parseAes(data);
  }
}
