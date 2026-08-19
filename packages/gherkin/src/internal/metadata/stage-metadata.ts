import type {
  StagedHook,
  StagedInject,
  StagedParameterType,
  StagedPriority,
  StagedStep,
} from "./staged.js";
import {
  HOOKS_METADATA,
  INJECTS_METADATA,
  PARAMETER_TYPES_METADATA,
  PRIORITIES_METADATA,
  STEPS_METADATA,
} from "./symbols.js";

/** Compound modifier key — see StagedPriority.key for why never bare methodName. */
export const toModifierKey = (isStatic: boolean, methodName: string): string =>
  `${isStatic}:${methodName}`;

// TC39 gives a subclass a metadata object whose PROTOTYPE is the parent's, so
// a naive `(metadata[key] ??= []).push(...)` resolves the parent's array
// through the chain and mutates it retroactively. Own-array discipline via
// Object.hasOwn — pinned: stage-metadata.test.ts.
const ensureOwnArray = <T>(metadata: DecoratorMetadataObject, key: symbol): Array<T> => {
  if (!Object.hasOwn(metadata, key)) {
    metadata[key] = [];
  }
  return metadata[key] as Array<T>;
};

const readOwnArray = <T>(metadata: DecoratorMetadataObject, key: symbol): Array<T> =>
  Object.hasOwn(metadata, key) ? (metadata[key] as Array<T>) : [];

export const stageStep = (metadata: DecoratorMetadataObject, step: StagedStep): void => {
  ensureOwnArray<StagedStep>(metadata, STEPS_METADATA).push(step);
};

export const stageParameterType = (
  metadata: DecoratorMetadataObject,
  parameterType: StagedParameterType,
): void => {
  ensureOwnArray<StagedParameterType>(metadata, PARAMETER_TYPES_METADATA).push(
    parameterType,
  );
};

export const stageHook = (metadata: DecoratorMetadataObject, hook: StagedHook): void => {
  ensureOwnArray<StagedHook>(metadata, HOOKS_METADATA).push(hook);
};

export const stageInject = (
  metadata: DecoratorMetadataObject,
  inject: StagedInject,
): void => {
  ensureOwnArray<StagedInject>(metadata, INJECTS_METADATA).push(inject);
};

export const stagePriority = (
  metadata: DecoratorMetadataObject,
  priority: StagedPriority,
): void => {
  ensureOwnArray<StagedPriority>(metadata, PRIORITIES_METADATA).push(priority);
};

export const readOwnSteps = (metadata: DecoratorMetadataObject): Array<StagedStep> =>
  readOwnArray<StagedStep>(metadata, STEPS_METADATA);

export const readOwnHooks = (metadata: DecoratorMetadataObject): Array<StagedHook> =>
  readOwnArray<StagedHook>(metadata, HOOKS_METADATA);

export const readOwnInjects = (metadata: DecoratorMetadataObject): Array<StagedInject> =>
  readOwnArray<StagedInject>(metadata, INJECTS_METADATA);

export const readOwnPriorities = (
  metadata: DecoratorMetadataObject,
): Array<StagedPriority> => readOwnArray<StagedPriority>(metadata, PRIORITIES_METADATA);

export const readOwnParameterTypes = (
  metadata: DecoratorMetadataObject,
): Array<StagedParameterType> =>
  readOwnArray<StagedParameterType>(metadata, PARAMETER_TYPES_METADATA);
