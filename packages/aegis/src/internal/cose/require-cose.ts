import type { CoseError } from "../../errors/index.js";
import { type CoseArity, unwrapCose } from "./unwrap-cose.js";

/**
 * {@link unwrapCose} with the refusal attached — the shape every COSE read path
 * actually needs: reach the structure array, or fail with the structural
 * `cose_malformed` verdict.
 *
 * `unwrapCose` itself stays a pure decision and never throws, because the words
 * differ per structure (a COSE_Sign1 and a COSE_Encrypt0 are malformed in
 * different terms, under different leaf error classes). Those words are DATA
 * here, so the code — `cose_malformed`, on every wire — cannot drift.
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
