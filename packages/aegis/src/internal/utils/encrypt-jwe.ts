import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { JweKit } from "../../classes/JweKit.js";
import type {
  CertificateBindingMode,
  JweEncryptOptions,
  TokenContent,
} from "../../types/index.js";

/**
 * Encrypt a JWE with an already-resolved recipient key (formerly
 * `JoseKit.encryptJwe`), built directly from the resolved key + JOSE config.
 * `defaultEncryption` is the deployment fallback for a recipient key that
 * declares no `encryption` of its own — the key's declaration wins. Returns the
 * BARE compact JWE token (the kit returns bare;
 * the domain `EncryptedToken`/`SignedToken` sugar is built by the caller).
 */
export const encryptJwe = ({
  kryptos,
  data,
  options,
  defaultEncryption,
  certBindingMode,
  certificateThumbprintSha1,
  logger,
}: {
  kryptos: IKryptos;
  data: TokenContent;
  options?: JweEncryptOptions;
  defaultEncryption: KryptosEncryption | undefined;
  certBindingMode: CertificateBindingMode;
  /** Resolved deployment default for the SHA-1 thumbprint (`x5t`) emission gate. */
  certificateThumbprintSha1: boolean;
  logger: ILogger;
}): string =>
  new JweKit({ certBindingMode, defaultEncryption, kryptos, logger }).encrypt(data, {
    ...(options ?? {}),
    certificateThumbprintSha1:
      options?.certificateThumbprintSha1 ?? certificateThumbprintSha1,
  });
