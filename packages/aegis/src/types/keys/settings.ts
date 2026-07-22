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
  /**
   * Emit the SHA-1 certificate thumbprint (`x5t`) alongside `x5t#S256` on every
   * cert-bound token this deployment signs/encrypts. Default `true` (older-client
   * compat). A per-call sign/mint/encrypt option overrides it. The read side never
   * verifies SHA-1 — this is a write-side emission gate only.
   */
  certificateThumbprintSha1?: boolean;
  clockTolerance?: number;
  dpopMaxSkew?: number;
  encryption?: KryptosEncryption;
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
