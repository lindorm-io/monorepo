import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { AegisError } from "../../errors/index.js";
import { matches } from "./matches.js";

/**
 * The error class a `validate` failure is raised as. Every caller names its OWN
 * layer's class and code, because a failure is attributed to the layer that
 * raised it and never to this shared body: a kit reports a kit error with its
 * wire-spelled code, the domain reports a domain error with a wire-neutral one.
 */
type AegisErrorClass = new (
  message: string,
  options: {
    code: string;
    data?: Dict;
    debug?: Dict;
    title: string;
    details: string;
  },
) => AegisError;

/**
 * Throwing claim matching — the shared body behind `Aegis.assert`, the verify
 * pipeline's matcher pass, and both claims kits' temporal + assert pass.
 *
 * ⚠ It used to throw a bare `LindormError`, which is the SUPERCLASS of
 * `AegisError`, so the instance satisfied no `instanceof AegisError` guard.
 * `instanceof` IS this package's error interface — a consumer branches on it to
 * turn a token rejection into a 401 — so a failure raised here fell straight
 * through that guard and surfaced as a generic 500 that told the caller nothing.
 * One throw site, four doors.
 *
 * ⚠ The class and code are the CALLER's, not a default. A shared body that
 * picked one for everybody would have made a kit-layer failure present as a
 * domain error under a wire-neutral code — which is the opposite of the rule
 * that kits speak wire and the domain does not.
 */
export const validate = <C extends Dict = Dict>(
  dict: C,
  predicate: Condition<C>,
  error: AegisErrorClass,
  code: string,
): void => {
  if (matches(dict, predicate)) return;

  const invalid: Array<{ key: string; value: any }> = [];
  for (const [key, ops] of Object.entries(predicate)) {
    if (!matches({ [key]: dict[key] }, { [key]: ops } as any)) {
      invalid.push({ key, value: dict[key] });
    }
  }

  throw new error("Invalid token", {
    code,
    data: { invalid: invalid.map(({ key }) => key) },
    debug: { invalid },
    title: "Claims Invalid",
    details:
      "One or more claims did not satisfy the supplied validation predicate; see the invalid list for the failing claim keys.",
  });
};
