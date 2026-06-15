import { isObject, isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

// The common layer is DOMAIN-keyed: actor members are domain names
// (subject→sub, issuer→iss, audience→aud, clientId→client_id, nested act).
const PERMITTED_MEMBERS = new Set(["subject", "issuer", "audience", "clientId", "act"]);

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

  if (node.subject !== undefined && !isString(node.subject)) {
    invalid.push({
      key: `${path}.subject`,
      message: `"${path}.subject" must be a string`,
    });
  }
  if (node.issuer !== undefined && !isString(node.issuer)) {
    invalid.push({ key: `${path}.issuer`, message: `"${path}.issuer" must be a string` });
  }
  if (node.clientId !== undefined && !isString(node.clientId)) {
    invalid.push({
      key: `${path}.clientId`,
      message: `"${path}.clientId" must be a string`,
    });
  }
  if (
    node.audience !== undefined &&
    !isArray(node.audience) &&
    !isString(node.audience)
  ) {
    invalid.push({
      key: `${path}.audience`,
      message: `"${path}.audience" must be a string or array of strings`,
    });
  }

  if (node.act !== undefined) {
    validateActor(node.act, `${path}.act`, invalid);
  }
};

/**
 * RFC 8693 — `act`/`mayAct` are recursive actor objects whose members are
 * limited to `subject`/`issuer`/`audience`/`clientId`/nested `act`. Validates
 * each chain when present. (Domain-keyed: `mayAct`, not the wire `may_act`.)
 */
export const actChainShape = (claims: Dict): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  if (claims.act !== undefined) validateActor(claims.act, "act", invalid);
  if (claims.mayAct !== undefined) validateActor(claims.mayAct, "mayAct", invalid);

  return invalid;
};
