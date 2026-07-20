import { AegisDomainError } from "../../errors/index.js";

type VerifyPartyBindingOptions = {
  /** This recipient's configured identity (base64url `apv`), or `undefined`. */
  expected: string | undefined;
  /** The `apv` carried on the incoming token's protected header, or `undefined`. */
  actual: string | undefined;
};

// RECIPIENT-ADDRESSING CHECK (defense-in-depth).
//
// `apv` (ECDH-ES Agreement PartyVInfo) is already bound into the derived key AND
// the protected-header AAD, so a token minted for a different recipient ALREADY
// fails AEAD decryption. This check runs the comparison up front so the failure
// surfaces as an actionable "not addressed to this recipient" policy rejection
// rather than an opaque GCM auth-tag error.
//
// Only fires when the kit is configured with a `partyRecipient`. `apu`
// (partyProducer) is never verified — it is ephemeral/unauthenticated.
export const verifyPartyBinding = ({
  expected,
  actual,
}: VerifyPartyBindingOptions): void => {
  if (expected === undefined) return;

  if (actual !== expected) {
    throw new AegisDomainError("token not addressed to this recipient", {
      code: "party_recipient_mismatch",
      debug: { expected, received: actual },
      title: "Party Recipient Mismatch",
      details:
        "This JweKit is configured with a partyRecipient identity, but the token's apv (ECDH-ES Agreement PartyVInfo) does not match it, so the token was not addressed to this recipient.",
    });
  }
};
