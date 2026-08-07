import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type {
  AesContent,
  AesDecryptionRecord,
  AesEncryptionRecord,
  SerialisedAesDecryption,
  SerialisedAesEncryption,
} from "../types/index.js";
import type { PreparedEncryption } from "../internal/types/prepared-encryption.js";

export type AesEncryptOptions = {
  // RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo (apu/apv). Only the ECDH-ES
  // key-agreement algorithms consume them; carried on the header so a recipient
  // re-derives the identical content encryption key.
  apu?: Buffer;
  apv?: Buffer;
};

/**
 * The `record` format carries no header, so it is the only mode that accepts a
 * caller-supplied AAD. The AAD is bound to the ciphertext but deliberately NOT
 * stored with it — the caller re-supplies it on decrypt, which is what makes it
 * a binding. The `cbor` and `serialised` formats derive their AAD from their own
 * header (RFC 7516 §5.1 style) and therefore accept no caller AAD.
 */
export type AesRecordEncryptOptions = AesEncryptOptions & {
  aad?: Buffer;
};

/**
 * Decryption takes an AAD only. `apu`/`apv` are encrypt-time key-agreement
 * inputs and always travel on the parsed input, never on the options.
 */
export type AesDecryptOptions = {
  aad?: Buffer;
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

/**
 * The header-less ciphertext, described in full. `encryption` is REQUIRED and
 * sits here rather than on the kit because the algorithm is part of the
 * ciphertext's description, exactly like the IV and the tag — the caller reads
 * it off the wire (a COSE protected header) and cannot decrypt without it. The
 * kit's key-derived cipher never applies to a decrypt: it would ignore what the
 * sender actually used.
 */
export type AesContentDecryption = {
  aad?: Buffer;
  ciphertext: Buffer;
  encryption: KryptosEncryption;
  iv: Buffer;
  tag: Buffer;
};

export interface IAesKit {
  kryptos: IKryptos;

  encrypt(content: AesContent, options?: AesEncryptOptions): string;
  encrypt(content: AesContent, mode: "cbor", options?: AesEncryptOptions): string;
  encrypt(
    content: AesContent,
    mode: "record",
    options?: AesRecordEncryptOptions,
  ): AesEncryptionRecord;
  encrypt(
    content: AesContent,
    mode: "serialised",
    options?: AesEncryptOptions,
  ): SerialisedAesEncryption;

  decrypt<T extends AesContent = string>(
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesDecryptOptions,
  ): T;
  verify(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesDecryptOptions,
  ): boolean;
  assert(
    input: AesContent,
    data: AesDecryptionRecord | SerialisedAesDecryption | string,
    options?: AesDecryptOptions,
  ): void;

  encryptContent(content: Buffer, options?: AesContentOptions): AesContentEncryption;
  decryptContent(input: AesContentDecryption): Buffer;

  prepareEncryption(options?: { apu?: Buffer; apv?: Buffer }): PreparedEncryption;
}
