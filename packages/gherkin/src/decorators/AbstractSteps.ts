import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../errors/GherkinError.js";
import { ABSTRACT_STEPS_BRAND } from "../internal/metadata/symbols.js";
import type { AbstractConstructor } from "../types/abstract-constructor.js";
import { assertNoConflictingBrand } from "./assert-no-conflicting-brand.js";
import { findStagedBehaviour } from "./find-staged-behaviour.js";

/**
 * Mark a base class that `@Binding`/`@Context` classes extend. REQUIRED on
 * any base carrying gherkin decorators — under swc's lowering an undecorated
 * base's metadata has a `null` prototype, so its staged fields silently
 * vanish from the chain (house pattern: proteus `@AbstractEntity`, iris
 * `@AbstractMessage`). May carry `@Inject` fields and plain helpers ONLY:
 * an inherited step either vanishes or registers once per leaf, and an
 * inherited hook would run once per extending class — the base is shared
 * wiring, never shared behaviour.
 */
export const AbstractSteps =
  () =>
  <T extends AbstractConstructor>(target: T, context: ClassDecoratorContext<T>): void => {
    // Own-brand self-check first, as in Binding.ts/Context.ts: a doubled
    // decorator would otherwise be silently idempotent — the one silent
    // outcome in the duplicate_* family.
    if (Object.hasOwn(target, ABSTRACT_STEPS_BRAND)) {
      throw new GherkinError(`@AbstractSteps is applied twice to class ${target.name}`, {
        code: "duplicate_abstract_steps",
        details:
          "The class is already marked as a shared base; a second @AbstractSteps adds nothing. Remove the extra decorator.",
        data: { className: target.name },
      });
    }

    // Before the behaviour check: a @Binding-branded class carries staged
    // steps, and blaming those would misname a conflicting-role mistake.
    assertNoConflictingBrand(target, "AbstractSteps");

    const behaviour = findStagedBehaviour(context.metadata);

    if (isUndefined(behaviour)) {
      Object.defineProperty(target, ABSTRACT_STEPS_BRAND, { value: true });
      return;
    }

    throw new GherkinError(
      `@AbstractSteps class ${target.name} declares ${behaviour.kind} ${behaviour.memberName}`,
      {
        code: "abstract_base_declares_behaviour",
        details:
          "An @AbstractSteps base may carry @Inject fields and plain helpers only. Steps, hooks, parameter types and priorities belong on the @Binding class — an inherited hook would run once per extending class, and an inherited step either vanishes or registers once per leaf.",
        data: {
          className: target.name,
          memberKind: behaviour.kind,
          memberName: behaviour.memberName,
        },
      },
    );
  };
