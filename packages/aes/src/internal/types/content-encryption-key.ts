import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { PublicEncryptionJwk } from "../../types/types.js";

export type CreateCekOptions = {
  encryption: KryptosEncryption;
  kryptos: IKryptos;
  // RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo. Wire/crypto names (apu/apv);
  // consumed only by the ECDH-ES key-derivation paths, ignored otherwise.
  apu?: Buffer;
  apv?: Buffer;
};

export type CreateCekResult = {
  contentEncryptionKey: Buffer;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type DecryptCekOptions = {
  encryption: KryptosEncryption;
  kryptos: IKryptos;
  // RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo (must match the values used on
  // encryption or the derived key differs and AEAD decryption fails).
  apu?: Buffer;
  apv?: Buffer;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type DecryptCekResult = {
  contentEncryptionKey: Buffer;
};
