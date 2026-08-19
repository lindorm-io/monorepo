import type { StagedParameterType, StagedStep } from "./staged.js";
import { PARAMETER_TYPES_METADATA, STEPS_METADATA } from "./symbols.js";

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

export const readOwnSteps = (metadata: DecoratorMetadataObject): Array<StagedStep> =>
  readOwnArray<StagedStep>(metadata, STEPS_METADATA);

export const readOwnParameterTypes = (
  metadata: DecoratorMetadataObject,
): Array<StagedParameterType> =>
  readOwnArray<StagedParameterType>(metadata, PARAMETER_TYPES_METADATA);
