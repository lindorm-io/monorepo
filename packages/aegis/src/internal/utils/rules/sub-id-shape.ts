import { isArray, isObject, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { SUBJECT_IDENTIFIER_REQUIRED_MEMBERS } from "../../claims/sub-id.js";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";
import { isClaimSatisfied } from "./is-claim-satisfied.js";

const ALIASES = "aliases";

/**
 * ONE Subject Identifier, at whatever depth it sits (RFC 9493 §3.2.8): every
 * check below runs at every depth and the entry names the POSITION rather than
 * the claim.
 * pinned: `sub-id-shape.test.ts#fails when an element of identifiers carries a
 * member its own format does not describe`
 *
 * ⚠ THE CEILING IS THE **SPECIFICATION'S**, AT BOTH DOORS (RFC 9493 §3) —
 * `security_event` states the rule `on: ["mint", "verify"]`
 * (`internal/profiles/definitions/security-event.ts`).
 *
 * ⚠ The permitted set is DERIVED from the per-format REQUIRED table and no second
 * table states it (RFC 9493 §3.2).
 * pinned: `sub-id-shape.test.ts#refuses a member beyond the format's required
 * ones, no RFC 9493 §3.2 format describing an optional member`
 */
const validateIdentifier = (
  value: unknown,
  path: string,
  invalid: Array<InvalidEntry>,
): void => {
  if (!isObject(value)) {
    invalid.push({ key: path, message: `${path} must be an object` });
    return;
  }

  if (!isString(value.format)) {
    invalid.push({ key: `${path}.format`, message: `${path}.format must be a string` });
    return;
  }

  const format = value.format;

  // ⛔ `.get`, and the table is a `Map` — `format` is a PRODUCER's string
  // validated only as text, so an object literal resolves `constructor` to
  // `Object`, the unknown-format arm never fires, and a bare `TypeError` escapes
  // both public doors. The permitted set below is a `Set` for the same reason.
  const required = SUBJECT_IDENTIFIER_REQUIRED_MEMBERS.get(format);

  // ⛔ NOT A REFUSAL AT EITHER DOOR (RFC 9493 §3) — a format absent from the table
  // demands nothing and forbids nothing.
  // pinned: sub-id-shape.test.ts#passes for an unknown format carrying members aegis does not model
  if (required === undefined) return;

  for (const member of required) {
    if (isClaimSatisfied(value[member])) continue;

    invalid.push({
      key: `${path}.${member}`,
      message: `${path} of format "${format}" requires member "${member}"`,
    });
  }

  const permitted = new Set(["format", ...required]);

  for (const member of Object.keys(value)) {
    if (permitted.has(member)) continue;

    // A prohibition reads the issuer's VOCABULARY, so a member handed
    // `undefined` is one nobody named (`is-claim-omitted.ts`).
    if (isClaimOmitted(value[member])) continue;

    invalid.push({
      key: `${path}.${member}`,
      message: `${path} of format "${format}" does not describe member "${member}"`,
    });
  }

  if (format !== ALIASES) return;

  const identifiers = value.identifiers;

  // Whether `identifiers` is an ARRAY is the structure's own question, refused by
  // the walker in both directions and under every profile.
  // pinned: classes/sub-id-claim-wire.test.ts#a non-array `identifiers` is refused as a violation of the CLAIM, not of the member
  if (!isArray(identifiers)) return;

  for (const [index, element] of identifiers.entries()) {
    const position = `${path}.identifiers[${index}]`;

    // ⛔ REFUSED WITHOUT DESCENDING (RFC 9493 §3.2.8) — stopping is what BOUNDS
    // the walk over an identifier that holds itself, which a caller's own bag can
    // carry at mint.
    // pinned: sub-id-shape.test.ts#fails once for an aliases identifier that holds itself
    if (isObject(element) && element.format === ALIASES) {
      invalid.push({
        key: position,
        message: `${position} must not be an identifier of format "${ALIASES}"`,
      });
      continue;
    }

    validateIdentifier(element, position, invalid);
  }
};

/**
 * RFC 9493 — when `sub_id` is present it must be an object with a string
 * `format`, carrying every member that format requires and none it does not
 * describe FOR A FORMAT THIS PACKAGE MODELS, and an `aliases` identifier may not
 * hold another.
 * pinned: `sub-id-shape.test.ts#passes for an unknown format carrying members
 * aegis does not model`
 *
 * ⚠ A format's required members are a DEMAND, so they read `isClaimSatisfied`
 * rather than mere presence — a bare `=== undefined` check accepts an empty one
 * (RFC 9493 §3.2). Live on `security_event`, which requires `subjectId` and
 * forbids `subject`, so `sub_id` is the only thing naming the subject of the
 * event.
 *
 * ⚠⚠ IT REPORTS IN THE **DOMAIN** VOCABULARY — `subjectId.phoneNumber`, never the
 * wire's `sub_id.phone_number`, matching `cnf-shape.ts` and `act-chain-shape.ts`.
 * An `InvalidEntry.key` is read by a caller who stated the claim in domain names
 * and never saw the wire's, and the same `invalid` field carries the policy
 * floor's entries.
 *
 * ⚠ `format` is ALSO a registry demand ({@link ClaimMemberSpec.required}),
 * enforced by the structure walker. This rule keeps its own check because it is
 * this function's PRECONDITION and because profile enforcement runs BEFORE any
 * wire assembly.
 */
export const subIdShape = (claims: Dict): Array<InvalidEntry> => {
  const value = claims.subjectId;

  if (isClaimOmitted(value)) return [];

  const invalid: Array<InvalidEntry> = [];

  validateIdentifier(value, "subjectId", invalid);

  return invalid;
};
