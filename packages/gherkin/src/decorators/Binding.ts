import { isFunction, isUndefined } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { GherkinError } from "../errors/GherkinError.js";
import {
  readOwnParameterTypes,
  readOwnSteps,
} from "../internal/metadata/stage-metadata.js";
import { BINDING_BRAND } from "../internal/metadata/symbols.js";
import { addRegistration } from "../internal/registry/registrations.js";

// Object.hasOwn, never `in`: the brand is a static, so a subclass inherits it
// through the constructor chain and a chain-walking read would blame the
// subclass itself instead of the branded ancestor.
const findBindingAncestor = (target: Constructor): Constructor | undefined => {
  let ancestor = Object.getPrototypeOf(target);

  while (isFunction(ancestor)) {
    if (Object.hasOwn(ancestor, BINDING_BRAND)) {
      return ancestor as unknown as Constructor;
    }
    ancestor = Object.getPrototypeOf(ancestor);
  }

  return undefined;
};

/**
 * Register a class's step definitions and parameter types. Registration reads
 * the class's OWN staged metadata only, and a `@Binding` class may not extend
 * another `@Binding` class — both would be instantiated with separate `this`,
 * so state set in a parent's step would be invisible to a child's. A plain
 * undecorated helper base is fine.
 */
export const Binding =
  () =>
  <T extends Constructor>(target: T, context: ClassDecoratorContext<T>): void => {
    // Own-brand self-check before the ancestor walk: a doubled decorator would
    // register every step twice and later misreport them as ambiguous, so the
    // error must blame the double decoration, not inheritance.
    if (Object.hasOwn(target, BINDING_BRAND)) {
      throw new GherkinError(`@Binding is applied twice to class ${target.name}`, {
        code: "duplicate_binding",
        title: "Duplicate Binding",
        details:
          "The class is already registered; a second @Binding would register every step and parameter type twice and later misreport them as ambiguous. Remove the extra decorator.",
        data: { className: target.name },
      });
    }

    const ancestor = findBindingAncestor(target);

    if (isUndefined(ancestor)) {
      // Inside a class decorator, target[Symbol.metadata] is the SUPERCLASS's
      // metadata — the class's own level is context.metadata. Pinned:
      // Binding.test.ts ("a subclass does not mutate its parent's staged steps").
      addRegistration({
        className: target.name,
        parameterTypes: readOwnParameterTypes(context.metadata),
        steps: readOwnSteps(context.metadata),
        target,
      });

      Object.defineProperty(target, BINDING_BRAND, { value: true });
      return;
    }

    throw new GherkinError(
      `@Binding class ${target.name} may not extend @Binding class ${ancestor.name}`,
      {
        code: "inheritance_forbidden",
        title: "Binding Inheritance Forbidden",
        details:
          "Each @Binding class is instantiated with its own `this`, so state set in a parent's step would be invisible to a child's. Extract shared members into an undecorated base class instead.",
        data: { child: target.name, parent: ancestor.name },
      },
    );
  };
