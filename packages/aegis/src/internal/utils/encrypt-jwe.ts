import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { JweKit } from "../../classes/JweKit.js";
import type {
  CertificateBindingMode,
  JweEncryptOptions,
  TokenContent,
} from "../../types/index.js";

/**
 * Encrypt a JWE with an already-resolved recipient key, built directly from the
 * resolved key + JOSE config.
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
  logger,
}: {
  kryptos: IKryptos;
  data: TokenContent;
  options?: JweEncryptOptions;
  defaultEncryption: KryptosEncryption | undefined;
  certBindingMode: CertificateBindingMode;
  logger: ILogger;
}): string =>
  new JweKit({ certBindingMode, defaultEncryption, kryptos, logger }).encrypt(
    data,
    options,
  );
