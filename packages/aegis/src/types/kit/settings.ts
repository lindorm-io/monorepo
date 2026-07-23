import type { IKryptos, KryptosEncryption } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { DsaEncoding } from "@lindorm/types";
import type { CertificateBindingMode } from "../header/domain-header.js";

export type SignKitSettings = {
  certBindingMode?: CertificateBindingMode;
  kryptos: IKryptos;
  logger: ILogger;
};

export type EncryptKitSettings = SignKitSettings & {
  encryption?: KryptosEncryption;
};

export type SignatureKitSettings = {
  dsa?: DsaEncoding;
  encoding?: BufferEncoding;
  kryptos: IKryptos;
  raw?: boolean;
};

// The wire kit holds only what a standalone JWS/JWT verifier needs: the key, a
// clock tolerance for the temporal range check, and the cert-binding mode. DPoP
// skew + issuer are DOMAIN concerns, handled by the Aegis verify path.
export type JwtKitSettings = SignKitSettings & {
  clockTolerance?: number;
};

export type JwsKitSettings = SignKitSettings;

export type JweKitSettings = EncryptKitSettings & {
  /**
   * This recipient's identity (base64url `apv` — ECDH-ES Agreement PartyVInfo).
   * When set, `decrypt` verifies the incoming token's `apv` equals it and rejects
   * a token addressed to a different recipient. `apu` (partyProducer) is never
   * verified — it is ephemeral/unauthenticated.
   */
  partyRecipient?: string;
};
