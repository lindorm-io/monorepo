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
  /**
   * The content-encryption AEAD for a key that DECLARES NONE — a fallback, not
   * an override. The key's own `encryption` wins; see `AesKitSettings`.
   */
  defaultEncryption?: KryptosEncryption;
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

/**
 * The COSE kit settings — the same three tiers the JOSE kits take, and for the
 * same reasons. `certBindingMode` reaches every one of them because a certificate
 * binding is verified on BOTH wires — `x5chain` (label 33) and `x5t` (label 34)
 * on COSE, RFC 9360 §2 — and `verify-cert-binding.ts` is wire-agnostic.
 */
export type CwsKitSettings = SignKitSettings;

export type CwtKitSettings = SignKitSettings & {
  /** Clock skew tolerance (seconds) for the in-kit temporal range check. */
  clockTolerance?: number;
};

export type CwmKitSettings = CwtKitSettings;

export type CweKitSettings = EncryptKitSettings;
