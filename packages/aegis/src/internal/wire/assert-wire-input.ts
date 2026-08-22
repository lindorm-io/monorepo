import { isUndefined } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { AegisDomainError } from "../../errors/index.js";
import type { Disposition, InputDisposition } from "./wire-input-disposition.js";

/** The `unsupported` arm, narrowed — the only one that can refuse anything. */
type Unsupported = Extract<Disposition, { use: "unsupported" }>;

const isRefused = (rule: Disposition, value: unknown): boolean =>
  rule.use === "unsupported" && !isUndefined(value);

/**
 * THE guard, run ONCE above the seam: a caller that supplied an option the chosen
 * wire declares `unsupported` is refused, by name, with the reason the table
 * states. The alternative is a rest-spread handing it to a kit that ignores it.
 *
 * ⚠ It reads CALLER INTENT, so it runs on the values the caller supplied, before
 * any deployment default is filled in. A default is not a request.
 */
export const assertWireInput = <T extends Dict>(
  disposition: InputDisposition<T>,
  input: T,
  context: { format: string; operation: string },
): void => {
  const entries = Object.entries(disposition);
  const refused = entries.find(([option, rule]) => isRefused(rule, input[option]));

  if (isUndefined(refused)) return;

  const [option, rule] = refused as [string, Unsupported];

  throw new AegisDomainError(`Option is not supported on this wire: ${option}`, {
    code: "wire_option_unsupported",
    data: {
      format: context.format,
      operation: context.operation,
      option,
      reason: rule.reason,
    },
    title: "Wire Option Unsupported",
    details: `The ${context.format} wire cannot honour the ${option} option, so the request is refused rather than accepted and ignored. ${rule.reason}`,
  });
};
