import type { Constructor } from "@lindorm/types";
import { GherkinError } from "../errors/GherkinError.js";
import {
  readOwnHooks,
  readOwnParameterTypes,
  readOwnPriorities,
  readOwnSteps,
} from "../internal/metadata/stage-metadata.js";
import { BINDING_BRAND } from "../internal/metadata/symbols.js";
import type { BindingRegistration } from "../internal/registry/registrations.js";
import { addRegistration } from "../internal/registry/registrations.js";
import { assertChainGuards } from "./assert-chain-guards.js";
import { assertNoConflictingBrand } from "./assert-no-conflicting-brand.js";
import { collectInjects } from "./collect-injects.js";
import { composeHooks } from "./compose-hooks.js";

/**
 * Register a class's step definitions, hooks and parameter types.
 * Registration reads the class's OWN staged metadata only; `@Inject` fields
 * are collected across the class chain. A `@Binding` class may extend
 * `@AbstractSteps` bases only — never another `@Binding` (both would be
 * instantiated with separate `this`, so state set in a parent's step would be
 * invisible to a child's), and never an unmarked class carrying gherkin
 * decorators (its metadata silently drops off the chain under swc).
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

    assertNoConflictingBrand(target, "Binding");
    assertChainGuards(target, "Binding");

    // Inside a class decorator, target[Symbol.metadata] is the SUPERCLASS's
    // metadata — the class's own level is context.metadata. Pinned:
    // Binding.test.ts ("a subclass does not mutate its parent's staged steps").
    const registration: BindingRegistration = {
      className: target.name,
      hooks: composeHooks(
        target.name,
        readOwnHooks(context.metadata),
        readOwnPriorities(context.metadata),
      ),
      injects: collectInjects(target, context.metadata),
      parameterTypes: readOwnParameterTypes(context.metadata),
      steps: readOwnSteps(context.metadata),
      target,
    };

    Object.defineProperty(target, BINDING_BRAND, { value: true });

    // Enqueued from an initializer, never inline: class decorators apply
    // inside-out and initializers run only once the whole declaration
    // succeeded, so a later decorator's throw leaves nothing in the queue.
    // Pinned: Binding.test.ts ("a LATER class decorator rejects the
    // declaration"), e2e/tsc-lowering.test.ts for the lowering `npm run
    // build` ships.
    context.addInitializer(() => addRegistration(registration));
  };
