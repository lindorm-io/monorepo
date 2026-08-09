import type { IEntity } from "../../../interfaces/index.js";
import { getForeignMetadata } from "../../entity/metadata/foreign-metadata.js";
import type {
  EntityMetadata,
  MetaRelation,
  MetaRelationId,
} from "../../entity/types/metadata.js";
import type { RepositoryFactory } from "../../types/repository-factory.js";
import { buildRelationFilter } from "./build-relation-filter.js";

export type EntityRelationIdContext = {
  metadata: EntityMetadata;
  repositoryFactory: RepositoryFactory;
  /** Driver-specific: the related entities a ManyToMany's join table points at. */
  loadManyToMany: (entity: IEntity, relation: MetaRelation) => Promise<Array<IEntity>>;
};

/**
 * Populate the async `@RelationId` properties of ONE entity, for the drivers
 * that cannot fetch them alongside the row and must query per entity.
 *
 * The value follows the relation's cardinality, exactly as the relational
 * drivers produce it: a `OneToMany` and a `ManyToMany` carry EVERY related id
 * as an array — empty when there are none — while an inverse `OneToOne` carries
 * the one id, or null. An owning `*ToOne` is skipped; it rides on a foreign key
 * hydrated with the row itself.
 *
 * Shared because the document drivers had a copy each, and the copies read a
 * `OneToMany` with `findOne` — one child's id where the relational drivers
 * return all of them.
 */
export const loadEntityRelationIds = async <E extends IEntity>(
  entity: E,
  relationIds: Array<MetaRelationId>,
  ctx: EntityRelationIdContext,
): Promise<void> => {
  for (const ri of relationIds) {
    const relation = ctx.metadata.relations.find((r) => r.key === ri.relationKey);
    if (!relation) continue;

    // Owning *ToOne is already hydrated by defaultHydrateEntity
    if (relation.joinKeys && relation.type !== "ManyToMany") continue;

    const foreignTarget = relation.foreignConstructor();
    const foreignMeta = getForeignMetadata(relation, foreignTarget);
    const pkKey = ri.column ?? foreignMeta.primaryKeys[0];

    if (relation.type === "ManyToMany") {
      const items = await ctx.loadManyToMany(entity, relation);
      (entity as any)[ri.key] = items.map((item) => (item as any)[pkKey]);
      continue;
    }

    const filter = buildRelationFilter(relation, entity, ctx.metadata, foreignMeta);
    const repo = ctx.repositoryFactory(foreignTarget, ctx.metadata.target);

    if (relation.type === "OneToMany") {
      const children = await repo.find(filter);
      (entity as any)[ri.key] = children.map((child) => (child as any)[pkKey]);
      continue;
    }

    const found = await repo.findOne(filter);
    (entity as any)[ri.key] = found ? (found as any)[pkKey] : null;
  }
};
