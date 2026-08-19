import { PENDING_STEP_BRAND } from "../internal/metadata/symbols.js";
import { GherkinError } from "./GherkinError.js";

/**
 * Thrown by a step definition whose body is not implemented yet — the snippet
 * for an undefined step throws it, so the scenario stays red until the step
 * is written. A CLASS, never a magic message string: the runner detects
 * pending by type, so a genuine failure whose message mentions "pending" is
 * never misreported. Instances carry a `Symbol.for` brand — the runner
 * detects pending via isPendingStepError, never instanceof, so a second
 * installed copy of this package still reports pending as pending.
 */
export class PendingStepError extends GherkinError {
  constructor(message: string = "Step is not implemented") {
    super(message, {
      code: "pending_step",
      title: "Pending Step",
      details:
        "The step matched a definition whose body is not implemented; the scenario is red until it is.",
    });

    Object.defineProperty(this, PENDING_STEP_BRAND, { value: true });
  }
}
