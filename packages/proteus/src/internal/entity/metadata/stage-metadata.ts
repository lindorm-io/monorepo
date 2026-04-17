import type { z } from "zod";
import type { IEntity } from "../../../interfaces";
import type { DiscriminatorValue, InheritanceStrategy } from "../types/inheritance";
import type {
  MetaCheck,
  MetaEntity,
  MetaExtra,
  MetaField,
  MetaFilter,
  MetaGenerated,
  MetaHook,
  MetaIndex,
  MetaPrimaryKey,
  MetaUnique,
  MetaVersionKey,
} from "../types/metadata";
import type {
  StagedCache,
  StagedEmbedded,
  StagedEmbeddedList,
  StagedFieldModifier,
  StagedJoinField,
  StagedJoinTable,
  StagedMetadata,
  StagedRelation,
  StagedRelationCount,
  StagedRelationId,
  StagedRelationModifier,
} from "../types/staged";

const ensureOwnArray = <K extends keyof StagedMetadata>(
  metadata: DecoratorMetadataObject,
  key: K,
): NonNullable<StagedMetadata[K]> => {
  if (!Object.hasOwn(metadata, key)) {
    metadata[key] = [];
  }
  return (metadata as any)[key];
};

// Field-level staging

export const stageField = (metadata: DecoratorMetadataObject, field: MetaField): void => {
  ensureOwnArray(metadata, "fields").push(field);
};

export const stageFieldModifier = (
  metadata: DecoratorMetadataObject,
  modifier: StagedFieldModifier,
): void => {
  ensureOwnArray(metadata, "fieldModifiers").push(modifier);
};

export const stageGenerated = (
  metadata: DecoratorMetadataObject,
  gen: MetaGenerated,
): void => {
  ensureOwnArray(metadata, "generated").push(gen);
};

export const stageIndex = (metadata: DecoratorMetadataObject, idx: MetaIndex): void => {
  ensureOwnArray(metadata, "indexes").push(idx);
};

export const stagePrimaryKey = (
  metadata: DecoratorMetadataObject,
  pk: MetaPrimaryKey,
): void => {
  ensureOwnArray(metadata, "primaryKeys").push(pk);
};

export const stageRelation = (
  metadata: DecoratorMetadataObject,
  rel: StagedRelation,
): void => {
  ensureOwnArray(metadata, "relations").push(rel);
};

export const stageRelationModifier = (
  metadata: DecoratorMetadataObject,
  modifier: StagedRelationModifier,
): void => {
  ensureOwnArray(metadata, "relationModifiers").push(modifier);
};

export const stageJoinField = (
  metadata: DecoratorMetadataObject,
  jf: StagedJoinField,
): void => {
  ensureOwnArray(metadata, "joinFields").push(jf);
};

export const stageJoinTable = (
  metadata: DecoratorMetadataObject,
  jt: StagedJoinTable,
): void => {
  ensureOwnArray(metadata, "joinTables").push(jt);
};

export const stageRelationId = (
  metadata: DecoratorMetadataObject,
  ri: StagedRelationId,
): void => {
  ensureOwnArray(metadata, "relationIds").push(ri);
};

export const stageRelationCount = (
  metadata: DecoratorMetadataObject,
  rc: StagedRelationCount,
): void => {
  ensureOwnArray(metadata, "relationCounts").push(rc);
};

export const stageUnique = (
  metadata: DecoratorMetadataObject,
  uniq: MetaUnique,
): void => {
  ensureOwnArray(metadata, "uniques").push(uniq);
};

export const stageVersionKey = (
  metadata: DecoratorMetadataObject,
  vk: MetaVersionKey,
): void => {
  ensureOwnArray(metadata, "versionKeys").push(vk);
};

export const stageEmbedded = (
  metadata: DecoratorMetadataObject,
  embedded: StagedEmbedded,
): void => {
  ensureOwnArray(metadata, "embeddeds").push(embedded);
};

export const stageEmbeddedList = (
  metadata: DecoratorMetadataObject,
  embeddedList: StagedEmbeddedList,
): void => {
  ensureOwnArray(metadata, "embeddedLists").push(embeddedList);
};

// Class-level staging

export const stageEmbeddable = (metadata: DecoratorMetadataObject): void => {
  metadata.__embeddable = true;
};

export const stageAbstractEntity = (metadata: DecoratorMetadataObject): void => {
  metadata.__abstract = true;
};

export const stageCache = (
  metadata: DecoratorMetadataObject,
  cache: StagedCache,
): void => {
  metadata.cache = cache;
};

export const stageDefaultOrder = (
  metadata: DecoratorMetadataObject,
  order: Record<string, "ASC" | "DESC">,
): void => {
  metadata.defaultOrder = order;
};

export const stageCheck = (metadata: DecoratorMetadataObject, check: MetaCheck): void => {
  ensureOwnArray(metadata, "checks").push(check);
};

export const stageEntity = (
  metadata: DecoratorMetadataObject,
  entity: MetaEntity,
): void => {
  metadata.entity = entity;
};

export const stageExtra = (metadata: DecoratorMetadataObject, extra: MetaExtra): void => {
  ensureOwnArray(metadata, "extras").push(extra);
};

export const stageFilter = (
  metadata: DecoratorMetadataObject,
  filter: MetaFilter,
): void => {
  ensureOwnArray(metadata, "filters").push(filter);
};

export const stageHook = (metadata: DecoratorMetadataObject, hook: MetaHook): void => {
  ensureOwnArray(metadata, "hooks").push(hook);
};

export const stageNamespace = (
  metadata: DecoratorMetadataObject,
  namespace: string,
): void => {
  metadata.namespace = namespace;
};

export const stageSchema = (
  metadata: DecoratorMetadataObject,
  schema: z.ZodObject<IEntity>,
): void => {
  ensureOwnArray(metadata, "schemas").push(schema);
};

// Inheritance staging

export const stageInheritance = (
  metadata: DecoratorMetadataObject,
  strategy: InheritanceStrategy,
): void => {
  metadata.__inheritance = strategy;
};

export const stageDiscriminator = (
  metadata: DecoratorMetadataObject,
  fieldName: string,
): void => {
  metadata.__discriminator = { fieldName };
};

export const stageDiscriminatorValue = (
  metadata: DecoratorMetadataObject,
  value: DiscriminatorValue,
): void => {
  metadata.__discriminatorValue = value;
};

export const stageAppendOnly = (metadata: DecoratorMetadataObject): void => {
  metadata.__appendOnly = true;
};
