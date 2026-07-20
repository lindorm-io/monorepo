import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { AesContent, AesContentType } from "../../types/content.js";
import type { PublicEncryptionJwk } from "../../types/types.js";

export type PrepareEncryptionOptions = {
  encryption?: KryptosEncryption;
  kryptos: IKryptos;
  // RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo (apu/apv). Forwarded to the
  // key-derivation step; consumed only by the ECDH-ES paths.
  apu?: Buffer;
  apv?: Buffer;
};

export type EncryptContentOptions = {
  aad?: Buffer;
  contentEncryptionKey: Buffer;
  data: AesContent;
  encryption: KryptosEncryption;
  initialisationVector?: Buffer;
};

export type EncryptContentResult = {
  authTag: Buffer;
  content: Buffer;
  contentType: AesContentType;
  initialisationVector: Buffer;
};

export type PreparedEncryptionHeaderParams = {
  publicEncryptionJwk?: PublicEncryptionJwk;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type PreparedEncryption = {
  headerParams: PreparedEncryptionHeaderParams;
  publicEncryptionKey?: Buffer;
  encrypt(data: AesContent, options?: { aad?: Buffer }): EncryptContentResult;
};
