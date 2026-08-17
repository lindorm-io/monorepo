import { isObject, isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";
import { isClaimOmitted } from "./is-claim-omitted.js";

// The common layer is DOMAIN-keyed: actor members are domain names
// (subject→sub, issuer→iss, audience→aud, clientId→client_id, nested act).
const PERMITTED_MEMBERS = new Set(["subject", "issuer", "audience", "clientId", "act"]);

// The two chain ROOTS. Each is validated independently; a token may carry one,
// both or neither.
const CHAIN_CLAIMS = ["act", "mayAct"] as const;

// The actor members that must be a string when the actor names them. `audience`
// is not among them — RFC 7519 §4.1.3 defines `aud` as string-OR-array — and
// `act` is the recursive one.
const STRING_MEMBERS = ["subject", "issuer", "clientId"] as const;

// `aud` inside an actor, validated only when the actor NAMES it.
const validateAudience = (
  audience: unknown,
  path: string,
  invalid: Array<InvalidEntry>,
): void => {
  if (isClaimOmitted(audience)) return;
  if (isArray(audience)) return;
  if (isString(audience)) return;

  invalid.push({
    key: `${path}.audience`,
    message: `"${path}.audience" must be a string or array of strings`,
  });
};

const validateActor = (
  actor: unknown,
  path: string,
  invalid: Array<InvalidEntry>,
): void => {
  if (!isObject(actor)) {
    invalid.push({ key: path, message: `"${path}" must be an object` });
    return;
  }

  const node = actor;

  for (const key of Object.keys(node)) {
    if (!PERMITTED_MEMBERS.has(key)) {
      invalid.push({
        key: `${path}.${key}`,
        message: `Unknown member "${key}" in "${path}"`,
      });
    }
  }

  for (const member of STRING_MEMBERS) {
    if (isClaimOmitted(node[member])) continue;
    if (isString(node[member])) continue;

    invalid.push({
      key: `${path}.${member}`,
      message: `"${path}.${member}" must be a string`,
    });
  }

  validateAudience(node.audience, path, invalid);

  if (isClaimOmitted(node.act)) return;

  validateActor(node.act, `${path}.act`, invalid);
};

/**
 * RFC 8693 — `act`/`mayAct` are recursive actor objects whose members are
 * limited to `subject`/`issuer`/`audience`/`clientId`/nested `act`. Validates
 * each chain when present. (Domain-keyed: `mayAct`, not the wire `may_act`.)
 */
export const actChainShape = (claims: Dict): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  for (const claim of CHAIN_CLAIMS) {
    if (isClaimOmitted(claims[claim])) continue;

    validateActor(claims[claim], claim, invalid);
  }

  return invalid;
};
