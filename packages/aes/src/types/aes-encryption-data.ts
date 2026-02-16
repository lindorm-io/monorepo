import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { AesContentType } from "./content";
import { PublicEncryptionJwk } from "./types";

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
