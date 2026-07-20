import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { JweKit } from "../../classes/JweKit.js";
import type {
  CertificateBindingMode,
  EncryptedJwe,
  JweEncryptOptions,
} from "../../types/index.js";

/**
 * Encrypt a JWE with an already-resolved recipient key (formerly
 * `JoseKit.encryptJwe`), built directly from the resolved key + JOSE config.
 * `encryption` is the resolved content-encryption AEAD (the caller's
 * `AegisEncKey.encryption` merged with the deployment default) — it picks the
 * cipher, never the key.
 */
export const encryptJwe = ({
  kryptos,
  data,
  options,
  encryption,
  certBindingMode,
  certificateThumbprintSha1,
  logger,
}: {
  kryptos: IKryptos;
  data: string;
  options?: JweEncryptOptions;
  encryption: KryptosEncryption;
  certBindingMode: CertificateBindingMode;
  /** Resolved deployment default for the SHA-1 thumbprint (`x5t`) emission gate. */
  certificateThumbprintSha1: boolean;
  logger: ILogger;
}): EncryptedJwe =>
  new JweKit({ certBindingMode, encryption, kryptos, logger }).encrypt(data, {
    ...(options ?? {}),
    certificateThumbprintSha1:
      options?.certificateThumbprintSha1 ?? certificateThumbprintSha1,
  });
