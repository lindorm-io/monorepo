import type { IAmphora } from "@lindorm/amphora";
import type { KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { CertificateBindingMode } from "../header/domain-header.js";
import type {
  AegisDecryptKey,
  AegisEncKey,
  AegisSignKey,
  AegisVerifyKey,
} from "./key-selectors.js";

export type AegisSettings = {
  amphora: IAmphora;
  logger: ILogger;
  issuer?: string;

  certBindingMode?: CertificateBindingMode;
  clockTolerance?: number;
  dpopMaxSkew?: number;
  /**
   * The deployment's content-encryption AEAD for a recipient key that DECLARES
   * NONE — a fallback, not an override. A key that declares its own
   * `encryption` wins on every path (JWE, COSE, AES): the declaration is what
   * the key IS. An imported peer JWK carries no `enc`, which is the case this
   * exists for. Omitted ⇒ `A256GCM`.
   */
  defaultEncryption?: KryptosEncryption;
  /**
   * This deployment's recipient identity (base64url `apv` — ECDH-ES Agreement
   * PartyVInfo). When set, decrypting/verifying an ECDH-ES JWE rejects a token
   * whose `apv` does not match — i.e. one not addressed to this recipient.
   * `apu` (partyProducer) is never verified.
   */
  partyRecipient?: string;

  /** Deployment signing policy — a QUERY over the vault. */
  sign?: AegisSignKey;
  /** Deployment encryption policy — a QUERY over the vault. */
  encrypt?: AegisEncKey;
  /** Deployment verification policy — a CHECK on the key the token names, or a key supplied outright. */
  verify?: AegisVerifyKey;
  /** Deployment decryption policy — a CHECK on the key the token names. */
  decrypt?: AegisDecryptKey;
};
