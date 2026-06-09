import { LindormError, type LindormErrorOptions } from "@lindorm/errors";

export class CausationMissingEventsError extends LindormError {
  public static readonly namespace = "hermes";

  public constructor(options: LindormErrorOptions = {}) {
    super("Causation produces no event array in aggregate", {
      code: "causation_missing_events",
      title: "Causation Missing Events",
      details:
        "The causation did not produce an event array on the aggregate, so no events could be applied.",
      ...options,
    });
  }
}
