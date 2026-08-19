import type { Pickle } from "@cucumber/messages";
import { GherkinError } from "../../errors/GherkinError.js";

export type AssertPickleParityOptions = {
  consumedPickleKeys: Set<string>;
  pickleIndex: Map<string, Pickle>;
  supersededScenarioIds: Set<string>;
  uri: string;
};

/**
 * Every compiled pickle must be consumed by a scenario node, or superseded by
 * a failing node for its scenario (a zero-step scenario or outline compiles
 * pickles the walk deliberately replaces with one `empty-scenario` node). An
 * orphaned pickle is a scenario the model builder DROPPED — it would vanish
 * from the emitted suite and from the printed counts, the manufactured-green
 * bug class the structural invariant exists to hunt, caught here at
 * transform time instead of never.
 */
export const assertPickleParity = ({
  consumedPickleKeys,
  pickleIndex,
  supersededScenarioIds,
  uri,
}: AssertPickleParityOptions): void => {
  const orphans: Array<string> = [];

  for (const [key, pickle] of pickleIndex) {
    if (consumedPickleKeys.has(key)) {
      continue;
    }

    // astNodeIds[0] is the pickle's scenario id — for an outline row the key
    // is `${scenarioId}/${rowId}` (pickle-index.ts), so every row pickle of a
    // zero-step outline is superseded by that outline's one failing node.
    if (supersededScenarioIds.has(pickle.astNodeIds[0])) {
      continue;
    }

    orphans.push(key);
  }

  if (orphans.length === 0) {
    return;
  }

  throw new GherkinError(
    `Pickle parity violated: ${orphans.length} compiled pickle(s) reached no suite node for ${uri}`,
    {
      code: "model_invariant",
      title: "Model Invariant Violated",
      details:
        "compile() produced a pickle the AST walk neither consumed as a scenario node nor superseded with a failing node — the model builder dropped a scenario, which would silently vanish from the emitted suite.",
      data: { orphans, uri },
    },
  );
};
