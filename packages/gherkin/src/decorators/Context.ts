import { isUndefined } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { GherkinError } from "../errors/GherkinError.js";
import { readOwnPriorities } from "../internal/metadata/stage-metadata.js";
import { CONTEXT_BRAND } from "../internal/metadata/symbols.js";
import { addContextRegistration } from "../internal/registry/registrations.js";
import { assertChainGuards } from "./assert-chain-guards.js";
import { assertNoConflictingBrand } from "./assert-no-conflicting-brand.js";
import { collectInjects } from "./collect-injects.js";
import { composeHooks } from "./compose-hooks.js";
import { findStagedBehaviour } from "./find-staged-behaviour.js";

/**
 * Register a class as a scenario-scoped state token — one instance per
 * scenario (per Examples row), shared by every `@Binding` class injecting it.
 * May `@Inject` other contexts (resolution is recursive) and may extend an
 * `@AbstractSteps` base, under the same inheritance guards as `@Binding`.
 */
export const Context =
  () =>
  <T extends Constructor>(target: T, context: ClassDecoratorContext<T>): void => {
    // Own-brand self-check before the ancestor walk, as in Binding.ts: the
    // error must blame the double decoration, not inheritance.
    if (Object.hasOwn(target, CONTEXT_BRAND)) {
      throw new GherkinError(`@Context is applied twice to class ${target.name}`, {
        code: "duplicate_context",
        title: "Duplicate Context",
        details:
          "The class is already registered as a context token; a second @Context would register it twice. Remove the extra decorator.",
        data: { className: target.name },
      });
    }

    assertNoConflictingBrand(target, "Context");

    // A context is a state token, never a behaviour host: a step staged here
    // would silently never register, and a hook would silently never run.
    // A staged priority falls through to the composeHooks orphan check below.
    const behaviour = findStagedBehaviour(context.metadata);

    if (isUndefined(behaviour) === false && behaviour.kind !== "priority") {
      throw new GherkinError(
        `@Context class ${target.name} declares ${behaviour.kind} ${behaviour.memberName}`,
        {
          code: "context_declares_behaviour",
          title: "Context Declares Behaviour",
          details:
            "A @Context class carries state only. Steps, hooks and parameter types belong on a @Binding class — staged on a context, a step never registers and a hook never runs, a silent no-op. Move the member to a @Binding class.",
          data: {
            className: target.name,
            memberKind: behaviour.kind,
            memberName: behaviour.memberName,
          },
        },
      );
    }

    assertChainGuards(target, "Context");

    // A context hosts no hooks, so every own staged @Priority is an orphan —
    // composing an empty hook list is exactly that check.
    composeHooks(target.name, [], readOwnPriorities(context.metadata));

    addContextRegistration({
      className: target.name,
      injects: collectInjects(target, context.metadata),
      target,
    });

    Object.defineProperty(target, CONTEXT_BRAND, { value: true });
  };
