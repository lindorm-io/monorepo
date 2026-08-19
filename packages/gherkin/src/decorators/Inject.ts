import type { Constructor } from "@lindorm/types";
import { GherkinError } from "../errors/GherkinError.js";
import { readOwnInjects, stageInject } from "../internal/metadata/stage-metadata.js";

/**
 * Resolve a scenario-scoped token — a `@Context` class or `ScenarioInfo` —
 * into an INSTANCE field. Legal on `@Binding` and `@Context` classes and
 * their `@AbstractSteps` prototype chains; that legality is enforced by the
 * class decorators, so an `@Inject` on a class that never gains one is
 * undetectable here and stages metadata nothing reads (a `@Binding`/`@Context`
 * subclass surfaces it via the marker guard). Fields are assigned AFTER
 * construction — `this.<field>` is `undefined` inside the constructor and
 * populated before any step or hook runs.
 */
export const Inject =
  <T>(token: Constructor<T>) =>
  (_target: undefined, context: ClassFieldDecoratorContext<unknown, T>): void => {
    const fieldName = String(context.name);

    if (context.static === false) {
      const staged = readOwnInjects(context.metadata);

      if (staged.every((entry) => entry.fieldName !== fieldName)) {
        stageInject(context.metadata, { fieldName, token: token as Constructor });
        return;
      }

      throw new GherkinError(`@Inject is applied twice to field ${fieldName}`, {
        code: "duplicate_inject",
        title: "Duplicate Inject",
        details:
          "A field resolves one token; with two staged, resolution would silently pick one. Remove the extra decorator.",
        data: { field: fieldName },
      });
    }

    throw new GherkinError(`@Inject requires an instance field`, {
      code: "scope_violation",
      title: "Scope Violation",
      details:
        "Injection resolves from a per-scenario container; a static field outlives every scenario. Remove the static modifier.",
      data: { field: fieldName },
    });
  };
