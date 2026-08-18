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
 * ⭐ THE GRAMMAR IS ALL THAT IS LEFT HERE, AND IT IS THE ONLY PART A MEMBER SET
 * COULD NEVER HOLD. `internal/claims/cnf-members.ts` declares the members and the
 * translator enforces them in BOTH directions and under EVERY profile — so the
 * two rules this file used to add on top of that are gone, and their disposal is
 * worth stating rather than leaving as an absence:
 *
 *   - THE ALLOW LIST (`PERMITTED_MEMBERS`) WAS WRONG, not merely duplicated. It
 *     refused any member outside the declared five, and RFC 7800 §3.1 requires
 *     the opposite: "in the absence of such requirements, all confirmation
 *     members that are not understood by implementations MUST be ignored", with
 *     §6.2 establishing an IANA registry other specifications register into.
 *     §6.2.2's own initial contents name `jwe`, which aegis does not declare — so
 *     the list refused a member RFC 7800 itself defines.
 *   - THE `isObject` CHECK IS THE TRANSLATOR'S NOW, and strictly wider there:
 *     this rule ran only for the three profiles that name it, while a foreign
 *     token verified through the profile-less door reached no shape rule at all.
 *
 * ⚠ WHAT SURVIVES IS THE BYTE LENGTH AND THE ALPHABET, because a member set
 * cannot express either: `cnf-members.ts` says `thumbprint` is text, and RFC 7638
 * says it is a base64url SHA-256 digest — 43 characters decoding to 32 bytes.
 * That is a REFINEMENT of a value shape, which is a profile's question and not a
 * registry column.
 *
 * ⚠ AN EMPTY CONFIRMATION IS NOT THIS RULE'S BUSINESS EITHER. The translator
 * refuses it on the way out and the verify policy gate refuses it on the way in
 * (`internal/claims/translate.ts`, `internal/utils/apply-verify-policy.ts`), both
 * without a profile having to opt in.
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
