import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { AesContentType } from "./content.js";
import type { PublicEncryptionJwk } from "./types.js";

export type AesEncryptionRecord = {
  algorithm: KryptosAlgorithm;
  authTag: Buffer;
  content: Buffer;
  contentType: AesContentType;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionIv: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  publicEncryptionTag: Buffer | undefined;
  version: string;
};

export type SerialisedAesEncryption = {
  cek: string | undefined;
  ciphertext: string;
  header: string;
  iv: string;
  tag: string;
  v: string;
};
