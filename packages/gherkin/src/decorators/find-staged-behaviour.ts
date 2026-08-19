import {
  readOwnHooks,
  readOwnParameterTypes,
  readOwnPriorities,
  readOwnSteps,
} from "../internal/metadata/stage-metadata.js";

export type StagedBehaviour = {
  kind: "step" | "hook" | "parameter type" | "priority";
  memberName: string;
};

/**
 * First staged member on ONE own metadata level that is not an `@Inject`
 * field. `@Priority` counts: it can only modify a hook, and hooks are refused
 * wherever this check runs, so a staged priority there is always an orphan
 * modifier — the silently-inert kind this package refuses to ship.
 */
export const findStagedBehaviour = (
  metadata: DecoratorMetadataObject,
): StagedBehaviour | undefined => {
  const steps = readOwnSteps(metadata);

  if (steps.length > 0) {
    return { kind: "step", memberName: steps[0].methodName };
  }

  const hooks = readOwnHooks(metadata);

  if (hooks.length > 0) {
    return { kind: "hook", memberName: hooks[0].methodName };
  }

  const parameterTypes = readOwnParameterTypes(metadata);

  if (parameterTypes.length > 0) {
    return { kind: "parameter type", memberName: parameterTypes[0].methodName };
  }

  const priorities = readOwnPriorities(metadata);

  if (priorities.length > 0) {
    return { kind: "priority", memberName: priorities[0].methodName };
  }

  return undefined;
};
