import { isFunction, isUndefined } from "@lindorm/is";
import type { Constructor } from "@lindorm/types";
import { GherkinError } from "../errors/GherkinError.js";
import { getOwnMetadata } from "../internal/metadata/own-metadata.js";
import {
  ABSTRACT_STEPS_BRAND,
  BINDING_BRAND,
  CONTEXT_BRAND,
} from "../internal/metadata/symbols.js";
import { findStagedBehaviour } from "./find-staged-behaviour.js";

type ChainDecorator = "Binding" | "Context";

const throwInheritanceForbidden = (
  decorator: ChainDecorator,
  target: Constructor,
  ancestor: Constructor,
  ancestorDecorator: ChainDecorator,
): never => {
  throw new GherkinError(
    `@${decorator} class ${target.name} may not extend @${ancestorDecorator} class ${ancestor.name}`,
    {
      code: "inheritance_forbidden",
      title: `${decorator} Inheritance Forbidden`,
      details:
        "Each @Binding and @Context class is instantiated with its own `this`, so state set through the parent would be invisible through the child. Extract shared @Inject wiring into an @AbstractSteps base class instead.",
      data: { child: target.name, parent: ancestor.name },
    },
  );
};

/**
 * The `@Binding`/`@Context` class-chain walk. Brands, never metadata links:
 * with a SINGLE undecorated base the metadata chain looks healthy under both
 * lowerings while the base's hooks silently drop from own-only registration,
 * and a link check on a deep chain blames an already-decorated ancestor
 * instead of the unmarked one. Object.hasOwn, never `in`: the brands are
 * statics, so a subclass inherits them through the constructor chain and a
 * chain-walking read would blame the subclass itself. Pinned:
 * Binding.test.ts, Context.test.ts.
 */
export const assertChainGuards = (
  target: Constructor,
  decorator: ChainDecorator,
): void => {
  let ancestor = Object.getPrototypeOf(target);

  while (isFunction(ancestor)) {
    const ancestorClass = ancestor as unknown as Constructor;

    if (Object.hasOwn(ancestor, BINDING_BRAND)) {
      throwInheritanceForbidden(decorator, target, ancestorClass, "Binding");
    }

    if (decorator === "Context" && Object.hasOwn(ancestor, CONTEXT_BRAND)) {
      throwInheritanceForbidden(decorator, target, ancestorClass, "Context");
    }

    if (Object.hasOwn(ancestor, ABSTRACT_STEPS_BRAND)) {
      ancestor = Object.getPrototypeOf(ancestor);
      continue;
    }

    const metadata = getOwnMetadata(ancestor);

    if (isUndefined(metadata)) {
      // A plain helper base with no decorated members stays silent.
      ancestor = Object.getPrototypeOf(ancestor);
      continue;
    }

    const behaviour = findStagedBehaviour(metadata);

    if (isUndefined(behaviour)) {
      throw new GherkinError(
        `@${decorator} class ${target.name} may only extend @AbstractSteps classes — ${ancestorClass.name} is not marked @AbstractSteps`,
        {
          code: "abstract_base_undecorated",
          title: "Abstract Base Undecorated",
          details:
            "Under swc's decorator lowering an unmarked base's metadata drops off the prototype chain silently, so every ancestor declaring decorated members must carry @AbstractSteps. Mark the named class @AbstractSteps (its decorated members may be @Inject fields only) — unless it is decorated @Context: a context cannot double as a base, so restructure to @Inject it from a field instead of extending it.",
          data: { ancestor: ancestorClass.name, className: target.name },
        },
      );
    }

    throw new GherkinError(
      `@${decorator} class ${target.name} inherits ${behaviour.kind} ${behaviour.memberName} from class ${ancestorClass.name}`,
      {
        code: "abstract_base_declares_behaviour",
        title: "Abstract Base Declares Behaviour",
        details:
          "Registration is own-only, so an inherited step never registers and an inherited hook never runs — a silent no-op. Move the member onto the @Binding class; a shared base may carry @Inject fields only, marked @AbstractSteps.",
        data: {
          ancestor: ancestorClass.name,
          className: target.name,
          memberKind: behaviour.kind,
          memberName: behaviour.memberName,
        },
      },
    );
  }
};
