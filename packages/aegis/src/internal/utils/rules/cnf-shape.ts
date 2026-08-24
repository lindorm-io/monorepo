import { B64 } from "@lindorm/b64";
import { isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { B64U } from "../../constants/format.js";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";

// A base64url SHA-256 thumbprint decodes to exactly 32 bytes.
const JKT_BYTE_LENGTH = 32;

// `cnf.jkt` (RFC 7638 / RFC 9449 §6.1), validated only when the confirmation
// NAMES it — the same reading of presence the entry guard above uses.
// ⚠ This check is live on JOSE only. `COSE_CNF_LABELS` (internal/cose/cose-key.ts) carries `jwk` and
// `kid`; `jkt` is `wireAbsent`, so `encodeCnf` refuses a thumbprint on COSE whatever this returns.
// Shape rules are wire-neutral by signature and stay that way — the error-class inconsistency that
// creates is tracked as the mint-ordering item, which fixes it for all five rules at once.
const validateThumbprint = (thumbprint: unknown, invalid: Array<InvalidEntry>): void => {
  if (isClaimOmitted(thumbprint)) return;

  if (!isString(thumbprint)) {
    invalid.push({
      key: "confirmation.thumbprint",
      message: "confirmation.thumbprint (cnf.jkt) must be a string",
    });
    return;
  }

  try {
    if (B64.toBuffer(thumbprint, B64U).length === JKT_BYTE_LENGTH) return;

    invalid.push({
      key: "confirmation.thumbprint",
      message:
        "confirmation.thumbprint (cnf.jkt) must be a base64url SHA-256 (32-byte) thumbprint",
    });
  } catch {
    invalid.push({
      key: "confirmation.thumbprint",
      message: "confirmation.thumbprint (cnf.jkt) must be valid base64url",
    });
  }
};

/**
 * RFC 7800 / RFC 9449 — when `confirmation` is present, `thumbprint` (the JWK
 * SHA-256 thumbprint, wire `jkt`) must be a base64url string decoding to 32
 * bytes.
 *
 * ⭐ THE GRAMMAR IS ALL THAT LIVES HERE — the byte length and the alphabet, which
 * a member set cannot express (`internal/claims/cnf-members.ts` says `thumbprint`
 * is text; RFC 7638 makes it a base64url SHA-256 digest). Everything else the
 * member declaration and the translator already enforce, in BOTH directions and
 * under EVERY profile.
 *
 * ⛔ Do NOT add a member ALLOW LIST here: RFC 7800 §3.1 requires an unrecognised
 * confirmation member to be ignored, and RFC 7800 §6.2 makes the set extensible
 * by registration, so an allowlist refuses members RFC 7800 itself defines.
 *
 * ⚠ AN EMPTY CONFIRMATION IS NOT THIS RULE'S BUSINESS. The translator refuses it
 * on the way out and the verify policy gate on the way in
 * (`internal/claims/translate.ts`, `internal/utils/apply-verify-policy.ts`), both
 * without a profile having to opt in — a shape rule runs only for the profiles
 * that name it.
 */
export const cnfShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.confirmation;

  if (isClaimOmitted(value)) return [];

  if (!isObject(value)) {
    return [{ key: "confirmation", message: "confirmation (cnf) must be an object" }];
  }

  const invalid: Array<InvalidEntry> = [];

  validateThumbprint(value.thumbprint, invalid);

  return invalid;
};
