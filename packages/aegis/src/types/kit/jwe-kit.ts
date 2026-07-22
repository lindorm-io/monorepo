import type { EncryptKitSettings } from "./kit.js";

export type JweKitSettings = EncryptKitSettings & {
  /**
   * This recipient's identity (base64url `apv` — ECDH-ES Agreement PartyVInfo).
   * When set, `decrypt` verifies the incoming token's `apv` equals it and rejects
   * a token addressed to a different recipient. `apu` (partyProducer) is never
   * verified — it is ephemeral/unauthenticated.
   */
  partyRecipient?: string;
};
