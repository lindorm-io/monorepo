import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../errors/GherkinError.js";
import { toModifierKey } from "../internal/metadata/stage-metadata.js";
import type {
  ComposedHook,
  StagedHook,
  StagedPriority,
} from "../internal/metadata/staged.js";

export const DEFAULT_HOOK_PRIORITY = 10_000;

/**
 * Joins `@Priority` onto hooks by the compound `${static}:${methodName}` key
 * and refuses any priority left over — on a step, a `@ParameterType` method
 * or an undecorated method it would be silently inert (steps run in pickle
 * order; ambiguity is an error, not a resolution). Pinned:
 * compose-hooks.test.ts.
 */
export const composeHooks = (
  className: string,
  hooks: Array<StagedHook>,
  priorities: Array<StagedPriority>,
): Array<ComposedHook> => {
  const consumed = new Set<string>();

  const composed = hooks.map((hook) => {
    const key = toModifierKey(hook.static, hook.methodName);
    const priority = priorities.find((entry) => entry.key === key);

    if (isUndefined(priority)) {
      return { ...hook, priority: DEFAULT_HOOK_PRIORITY };
    }

    consumed.add(key);
    return { ...hook, priority: priority.priority };
  });

  const orphan = priorities.find((entry) => consumed.has(entry.key) === false);

  if (isUndefined(orphan)) {
    return composed;
  }

  throw new GherkinError(
    `@Priority on method ${orphan.methodName} of class ${className} has no hook to modify`,
    {
      code: "priority_without_hook",
      details:
        "@Priority orders hooks and nothing else — steps run in pickle order and parameter types have no order, so a priority there would be silently inert. Remove it, or add the hook decorator it was meant for.",
      data: { className, method: orphan.methodName, static: orphan.static },
    },
  );
};
