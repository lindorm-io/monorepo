import type { IKryptos } from "@lindorm/kryptos";
import type {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types/index.js";
import type { PreparedEncryption } from "../internal/types/prepared-encryption.js";

export type AesOperationOptions = {
  aad?: Buffer;
  // RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo (apu/apv). Only the ECDH-ES
  // key-agreement algorithms consume them; carried on the header so a recipient
  // re-derives the identical content encryption key.
  apu?: Buffer;
  apv?: Buffer;
};

export type AesContentOptions = {
  aad?: Buffer;
  iv?: Buffer;
};

export type AesContentEncryption = {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
};

export type AesContentDecryption = {
  aad?: Buffer;
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
};

export interface IAesKit {
  kryptos: IKryptos;

  encrypt(content: AesContent, options?: AesOperationOptions): string;
  encrypt(content: AesContent, mode: "cbor", options?: AesOperationOptions): string;
  encrypt(
    content: AesContent,
    mode: "record",
    options?: AesOperationOptions,
  ): AesEncryptionRecord;
  encrypt(
    content: AesContent,
    mode: "serialised",
    options?: AesOperationOptions,
  ): SerialisedAesEncryption;

  decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): T;
  verify(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): boolean;
  assert(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesOperationOptions,
  ): void;

  encryptContent(content: Buffer, options?: AesContentOptions): AesContentEncryption;
  decryptContent(input: AesContentDecryption): Buffer;

  prepareEncryption(options?: { apu?: Buffer; apv?: Buffer }): PreparedEncryption;
}
