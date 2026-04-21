import type {
  MetaAggregate,
  MetaDto,
  MetaForgettable,
  MetaHandler,
  MetaMethodModifier,
  MetaSaga,
  MetaUpcaster,
  MetaValidation,
  MetaView,
  StagedMetadata,
} from "./types.js";

const ensureOwnArray = <K extends keyof StagedMetadata>(
  metadata: DecoratorMetadataObject,
  key: K,
): NonNullable<StagedMetadata[K]> => {
  if (!Object.hasOwn(metadata, key)) {
    metadata[key] = [];
  }
  return (metadata as any)[key];
};

// -- Class-level staging (singletons) --

export const stageDto = (metadata: DecoratorMetadataObject, dto: MetaDto): void => {
  metadata.dto = dto;
};

export const stageAggregate = (
  metadata: DecoratorMetadataObject,
  aggregate: MetaAggregate,
): void => {
  metadata.aggregate = aggregate;
};

export const stageSaga = (metadata: DecoratorMetadataObject, saga: MetaSaga): void => {
  metadata.saga = saga;
};

export const stageView = (metadata: DecoratorMetadataObject, view: MetaView): void => {
  metadata.view = view;
};

export const stageNamespace = (
  metadata: DecoratorMetadataObject,
  namespace: string,
): void => {
  metadata.namespace = namespace;
};

export const stageForgettable = (
  metadata: DecoratorMetadataObject,
  forgettable: MetaForgettable,
): void => {
  metadata.forgettable = forgettable;
};

// -- Method-level staging (arrays) --

export const stageHandler = (
  metadata: DecoratorMetadataObject,
  handler: MetaHandler,
): void => {
  ensureOwnArray(metadata, "handlers").push(handler);
};

export const stageMethodModifier = (
  metadata: DecoratorMetadataObject,
  modifier: MetaMethodModifier,
): void => {
  ensureOwnArray(metadata, "methodModifiers").push(modifier);
};

export const stageUpcaster = (
  metadata: DecoratorMetadataObject,
  upcaster: MetaUpcaster,
): void => {
  ensureOwnArray(metadata, "upcasters").push(upcaster);
};

export const stageValidation = (
  metadata: DecoratorMetadataObject,
  validation: MetaValidation,
): void => {
  ensureOwnArray(metadata, "validations").push(validation);
};
