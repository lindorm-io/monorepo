import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { AesContentType } from "./content";
import { PublicEncryptionJwk } from "./types";

export type AesEncryptionRecord = {
  algorithm: KryptosAlgorithm;
  authTag: Buffer;
  content: Buffer;
  contentType: AesContentType;
  encryption: KryptosEncryption;
  hkdfSalt: Buffer | undefined;
  initialisationVector: Buffer;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionIv: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  publicEncryptionTag: Buffer | undefined;
  version: number;
};

export type SerialisedAesEncryption = {
  algorithm: KryptosAlgorithm;
  authTag: string;
  content: string;
  contentType: AesContentType;
  encryption: KryptosEncryption;
  hkdfSalt: string | undefined;
  initialisationVector: string;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: string | undefined;
  publicEncryptionIv: string | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: string | undefined;
  publicEncryptionTag: string | undefined;
  version: number;
};
