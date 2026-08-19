import type { Pickle } from "@cucumber/messages";
import { isObject } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";

/**
 * `[scenarioId]` for a plain scenario, `[scenarioId, rowId]` for an outline
 * row — exactly the astNodeIds compile() writes onto each pickle.
 */
export const pickleKey = (astNodeIds: ReadonlyArray<string>): string =>
  astNodeIds.join("/");

export const buildPickleIndex = (pickles: ReadonlyArray<Pickle>): Map<string, Pickle> =>
  new Map(pickles.map((pickle) => [pickleKey(pickle.astNodeIds), pickle]));

export const requirePickle = (index: Map<string, Pickle>, key: string): Pickle => {
  const pickle = index.get(key);

  if (isObject<Pickle>(pickle)) {
    return pickle;
  }

  throw new GherkinError(`No pickle compiled for AST node "${key}"`, {
    code: "model_invariant",
    title: "Model Invariant Violated",
    details:
      "The AST walk expected compile() to have produced a pickle for this scenario or Examples row and it did not — the @cucumber/gherkin dependency changed behaviour underneath the model builder.",
    data: { key },
  });
};
