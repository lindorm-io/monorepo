import type { ConditionOperator } from "@lindorm/match";
import { isArray, isNumber, isObject, isString } from "@lindorm/is";
import type { ClaimSpec } from "../claims/claims-registry.js";

/**
 * The per-claim VALUE lift — the ONE place that turns a matcher VALUE into a
 * condition operator, shared by both matcher builders (`createIdentityMatchers`
 * on the verify path, `createJwtValidate` on the assert path).
 *
 * It exists because the lift is the half that needs the claim REGISTRY: only the
 * registry knows which claims are array-valued (`value: "array"` — aud/scope/amr/
 * roles/…), and for those a SCALAR matcher means "this one value must be present",
 * so it lifts to a single-element `$all` rather than an `$eq` that can never match
 * an array. Duplicating that knowledge is how the assert path came to refuse
 * `{ audience: "https://api.example.com" }` while verify accepted it.
 *
 * The KEY half stays with each builder: verify emits the WIRE name the registry
 * maps to (it matches a wire payload), assert emits the caller's own key (it
 * matches a domain-keyed dict). Only the value lift is common.
 *
 * Returns `undefined` for a value shape neither builder supports, so each keeps
 * its own error code and message for that case.
 */
export const liftClaimMatcher = (
  spec: ClaimSpec | undefined,
  value: unknown,
): ConditionOperator<any> | undefined => {
  if (isArray<string>(value)) return { $all: value };
  if (isObject(value)) return value as ConditionOperator<any>;

  // The array lift is string-only on purpose: a registry `value: "array"` claim
  // is an array of STRINGS, so a numeric matcher for one is malformed input and
  // keeps its literal-equality reading rather than being silently lifted.
  if (isString(value)) {
    return spec?.value === "array" ? { $all: [value] } : { $eq: value };
  }
  if (isNumber(value)) return { $eq: value };

  return undefined;
};
