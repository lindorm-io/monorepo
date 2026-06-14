import { isObject, isArray, isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { InvalidEntry } from "../../../types/index.js";

const PERMITTED_MEMBERS = new Set(["sub", "iss", "aud", "client_id", "act"]);

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

  if (node.sub !== undefined && !isString(node.sub)) {
    invalid.push({ key: `${path}.sub`, message: `"${path}.sub" must be a string` });
  }
  if (node.iss !== undefined && !isString(node.iss)) {
    invalid.push({ key: `${path}.iss`, message: `"${path}.iss" must be a string` });
  }
  if (node.client_id !== undefined && !isString(node.client_id)) {
    invalid.push({
      key: `${path}.client_id`,
      message: `"${path}.client_id" must be a string`,
    });
  }
  if (node.aud !== undefined && !isArray(node.aud) && !isString(node.aud)) {
    invalid.push({
      key: `${path}.aud`,
      message: `"${path}.aud" must be a string or array of strings`,
    });
  }

  if (node.act !== undefined) {
    validateActor(node.act, `${path}.act`, invalid);
  }
};

/**
 * RFC 8693 — `act`/`may_act` are recursive actor objects whose members are
 * limited to `sub`/`iss`/`aud`/`client_id`/nested `act`. Validates each chain
 * when present.
 */
export const actChainShape = (claims: Dict): Array<InvalidEntry> => {
  const invalid: Array<InvalidEntry> = [];

  if (claims.act !== undefined) validateActor(claims.act, "act", invalid);
  if (claims.may_act !== undefined) validateActor(claims.may_act, "may_act", invalid);

  return invalid;
};
