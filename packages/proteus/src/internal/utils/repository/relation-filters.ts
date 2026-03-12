import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata, MetaRelation } from "#internal/entity/types/metadata";

export const isOwningRelation = (relation: MetaRelation): boolean =>
  relation.type === "ManyToOne" || (relation.type === "OneToOne" && !!relation.joinKeys);

export const isInverseRelation = (relation: MetaRelation): boolean =>
  !isOwningRelation(relation);

export const findMirror = (
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
): MetaRelation | undefined =>
  foreignMetadata.relations.find((r) => r.key === relation.foreignKey);

export const isSelfReferencing = (
  relation: MetaRelation,
  mirror: MetaRelation,
): boolean => relation.key === mirror.key && relation.foreignKey === mirror.foreignKey;

export const shouldSkipParent = (
  relation: MetaRelation,
  foreignTarget: Constructor<IEntity>,
  mirror: MetaRelation | undefined,
  parent: Constructor<IEntity> | undefined,
): boolean => {
  if (!parent || foreignTarget !== parent) return false;
  if (!mirror || !isSelfReferencing(relation, mirror)) return true;
  return false;
};
