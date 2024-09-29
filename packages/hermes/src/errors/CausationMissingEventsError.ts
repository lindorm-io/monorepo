import { LindormError } from "@lindorm/errors";

export class CausationMissingEventsError extends LindormError {
  public constructor() {
    super("Causation produces no event array in aggregate");
  }
}
