import { LindormError } from "@lindorm/errors";

export class CausationMissingEventsError extends LindormError {
  public static readonly namespace = "hermes";

  public constructor() {
    super("Causation produces no event array in aggregate");
  }
}
