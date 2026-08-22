import type { CoseError } from "../../errors/index.js";
import { type CoseArity, unwrapCose } from "./unwrap-cose.js";

/**
 * {@link unwrapCose} with the refusal attached: reach the structure array, or fail
 * with the structural `cose_malformed` verdict.
 *
 * `unwrapCose` stays a pure decision and never throws, because the words differ
 * per structure and per leaf error class. Those words are DATA here, so the code
 * — `cose_malformed`, on every wire — cannot drift.
 */
export const requireCose = (
  value: unknown,
  {
    arity,
    tags,
    error,
    message,
    title,
    details,
  }: {
    arity: CoseArity;
    tags?: ReadonlyArray<number>;
    error: typeof CoseError;
    message: string;
    title: string;
    details: string;
  },
): Array<unknown> => {
  const contents = unwrapCose(value, { arity, tags });

  if (contents) return contents;

  throw new error(message, { code: "cose_malformed", title, details });
};
