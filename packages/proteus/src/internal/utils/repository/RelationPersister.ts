import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "../../entity/types/metadata";
import type { JoinTableOps } from "../../types/join-table-ops";
import type { RepositoryFactory } from "../../types/repository-factory";
import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata";
import { isLazyRelation } from "../../entity/utils/lazy-relation";
import { isLazyCollection } from "../../entity/utils/lazy-collection";
import { buildRelationFilter } from "./build-relation-filter";
import { isOwningRelation, findMirror, shouldSkipParent } from "./relation-filters";

export class RelationPersister {
  private readonly metadata: EntityMetadata;
  private readonly namespace: string | null;
  private readonly parent: Constructor<IEntity> | undefined;
  private readonly repositoryFactory: RepositoryFactory;
  private readonly joinTableOps: JoinTableOps;
  private readonly logger: ILogger;

  public constructor(ctx: {
    metadata: EntityMetadata;
    namespace: string | null;
    parent: Constructor<IEntity> | undefined;
    repositoryFactory: RepositoryFactory;
    joinTableOps: JoinTableOps;
    logger: ILogger;
  }) {
    this.metadata = ctx.metadata;
    this.namespace = ctx.namespace;
    this.parent = ctx.parent;
    this.repositoryFactory = ctx.repositoryFactory;
    this.joinTableOps = ctx.joinTableOps;
    this.logger = ctx.logger.child(["RelationPersister"]);
  }

  // ─── Phase 1: Owning relations (ManyToOne + owning OneToOne) ───────
  // Must run BEFORE the entity is persisted so FK values are in the INSERT/UPDATE

  public saveOwning = async <E extends IEntity>(
    entity: E,
    mode: "insert" | "update",
  ): Promise<void> => {
    if (!this.metadata.relations.length) return;
    this.logger.debug("saveOwning", { mode });

    for (const relation of this.metadata.relations) {
      if (!isOwningRelation(relation)) continue;

      const foreignTarget = relation.foreignConstructor();
      const foreignMetadata = getEntityMetadata(foreignTarget);
      const mirror = findMirror(relation, foreignMetadata);

      if (shouldSkipParent(relation, foreignTarget, mirror, this.parent)) continue;

      const shouldSave =
        (mode === "insert" && relation.options.onInsert === "cascade") ||
        (mode === "update" && relation.options.onUpdate === "cascade");

      if (!shouldSave) continue;

      const raw = (entity as any)[relation.key];
      if (isLazyRelation(raw)) continue;
      const related: IEntity | null = raw ?? null;
      if (!related) continue;

      const parentRepo = this.repositoryFactory(foreignTarget, this.metadata.target);
      const saved = await parentRepo.save(related);

      // Write FK from saved entity's PK back to this entity (RH7)
      // This mutates the entity BEFORE persist, so FK values are in the row
      if (relation.joinKeys) {
        for (const [fkCol, pkCol] of Object.entries(relation.joinKeys)) {
          (entity as any)[fkCol] = (saved as any)[pkCol];
        }
      }
    }
  };

  // ─── Phase 2: Inverse relations (OneToMany + inverse OneToOne + ManyToMany) ──
  // Must run AFTER the entity is persisted so the entity's PK is available

  public saveInverse = async <E extends IEntity>(
    entity: E,
    mode: "insert" | "update",
  ): Promise<void> => {
    if (!this.metadata.relations.length) return;

    for (const relation of this.metadata.relations) {
      if (isOwningRelation(relation)) continue;

      const foreignTarget = relation.foreignConstructor();
      const foreignMetadata = getEntityMetadata(foreignTarget);
      const mirror = findMirror(relation, foreignMetadata);

      if (shouldSkipParent(relation, foreignTarget, mirror, this.parent)) continue;

      const shouldSave =
        (mode === "insert" && relation.options.onInsert === "cascade") ||
        (mode === "update" && relation.options.onUpdate === "cascade");

      const shouldOrphan =
        (relation.options.onOrphan === "delete" ||
          relation.options.onOrphan === "nullify") &&
        mode === "update" &&
        (relation.type === "ManyToMany" || !relation.joinKeys);

      if (!shouldSave && !shouldOrphan) continue;

      // ─── ManyToMany: sync join table rows ──────────────────────────
      if (relation.type === "ManyToMany") {
        if (!mirror) continue;

        const rawM2M = (entity as any)[relation.key];
        if (isLazyCollection(rawM2M)) continue;
        const relatedEntities: Array<IEntity> = rawM2M ?? [];

        if (shouldSave && relatedEntities.length > 0) {
          const childRepo = this.repositoryFactory(foreignTarget, this.metadata.target);
          for (let i = 0; i < relatedEntities.length; i++) {
            relatedEntities[i] = await childRepo.save(relatedEntities[i]);
          }
        }

        if (shouldSave || shouldOrphan) {
          await this.joinTableOps.sync(
            entity,
            relatedEntities,
            relation,
            mirror,
            this.namespace,
          );
        }

        continue;
      }

      // ─── OneToMany / OneToOne (inverse side — no joinKeys) ─────────
      if (
        relation.type === "OneToMany" ||
        (relation.type === "OneToOne" && !relation.joinKeys)
      ) {
        const childRepo = this.repositoryFactory(foreignTarget, this.metadata.target);

        if (relation.type === "OneToMany") {
          const rawChildren = (entity as any)[relation.key];
          if (isLazyCollection(rawChildren)) continue;
          const children: Array<IEntity> = rawChildren ?? [];

          if (shouldSave) {
            for (let i = 0; i < children.length; i++) {
              // Set FK on child pointing back to this entity
              if (mirror?.joinKeys) {
                for (const [fkCol, pkCol] of Object.entries(mirror.joinKeys)) {
                  (children[i] as any)[fkCol] = (entity as any)[pkCol];
                }
              }
              children[i] = await childRepo.save(children[i]);
            }
          }

          if (shouldOrphan && mirror) {
            const filter = buildRelationFilter(relation, entity);
            const existing = await childRepo.find(filter);
            const currentPks = new Set(
              children.map((c) => this.serializePk(c, foreignMetadata)),
            );
            for (const orphan of existing) {
              if (!currentPks.has(this.serializePk(orphan, foreignMetadata))) {
                if (relation.options.onOrphan === "nullify" && mirror.joinKeys) {
                  for (const fkCol of Object.keys(mirror.joinKeys)) {
                    (orphan as any)[fkCol] = null;
                  }
                  await childRepo.save(orphan);
                } else {
                  await childRepo.destroy(orphan);
                }
              }
            }
          }
        } else {
          // OneToOne inverse
          const rawInverse = (entity as any)[relation.key];
          if (isLazyRelation(rawInverse)) continue;
          let related: IEntity | null = rawInverse ?? null;

          if (shouldSave && related) {
            if (mirror?.joinKeys) {
              for (const [fkCol, pkCol] of Object.entries(mirror.joinKeys)) {
                (related as any)[fkCol] = (entity as any)[pkCol];
              }
            }
            related = await childRepo.save(related);
          }

          if (shouldOrphan && mirror) {
            const filter = buildRelationFilter(relation, entity);
            const existing = await childRepo.findOne(filter);
            const shouldHandleOrphan =
              existing &&
              ((related &&
                this.serializePk(existing, foreignMetadata) !==
                  this.serializePk(related, foreignMetadata)) ||
                !related);
            if (shouldHandleOrphan) {
              if (relation.options.onOrphan === "nullify" && mirror.joinKeys) {
                for (const fkCol of Object.keys(mirror.joinKeys)) {
                  (existing as any)[fkCol] = null;
                }
                await childRepo.save(existing);
              } else {
                await childRepo.destroy(existing);
              }
            }
          }
        }

        continue;
      }
    }
  };

  // ─── Destroy: cascade-delete related entities ──────────────────────

  public destroy = async <E extends IEntity>(
    entity: E,
    soft?: boolean,
  ): Promise<void> => {
    if (!this.metadata.relations.length) return;

    for (const relation of this.metadata.relations) {
      const foreignTarget = relation.foreignConstructor();
      const foreignMetadata = getEntityMetadata(foreignTarget);
      const mirror = findMirror(relation, foreignMetadata);

      if (shouldSkipParent(relation, foreignTarget, mirror, this.parent)) continue;

      // Skip ManyToOne — never cascade to a parent you depend on (RH4)
      if (relation.type === "ManyToOne") continue;

      // Skip if not configured for cascade destroy
      const destroyAction = soft
        ? relation.options.onSoftDestroy
        : relation.options.onDestroy;
      if (destroyAction !== "cascade") continue;

      // ─── ManyToMany: delete join table rows ────────────────────────
      if (relation.type === "ManyToMany") {
        await this.joinTableOps.delete(entity, relation, this.namespace);
        continue;
      }

      // ─── OneToMany: find children and destroy each ─────────────────
      if (relation.type === "OneToMany") {
        const childRepo = this.repositoryFactory(foreignTarget, this.metadata.target);
        const filter = buildRelationFilter(relation, entity);
        const children = await childRepo.find(filter);
        for (const child of children) {
          await childRepo.destroy(child);
        }
        continue;
      }

      // ─── OneToOne (owning side): look up related by FK values and destroy ──
      if (relation.type === "OneToOne" && relation.joinKeys) {
        const childRepo = this.repositoryFactory(foreignTarget, this.metadata.target);
        const filter: Record<string, unknown> = {};
        for (const [localFkCol, foreignPkCol] of Object.entries(relation.joinKeys)) {
          filter[foreignPkCol] = (entity as any)[localFkCol] ?? null;
        }
        const child = await childRepo.findOne(filter);
        if (child) {
          await childRepo.destroy(child);
        }
        continue;
      }

      // ─── OneToOne (inverse side): find child and destroy ───────────
      if (relation.type === "OneToOne" && !relation.joinKeys) {
        const childRepo = this.repositoryFactory(foreignTarget, this.metadata.target);
        const filter = buildRelationFilter(relation, entity);
        const child = await childRepo.findOne(filter);
        if (child) {
          await childRepo.destroy(child);
        }
        continue;
      }
    }
  };

  private serializePk = (entity: IEntity, metadata: EntityMetadata): string =>
    JSON.stringify(metadata.primaryKeys.map((k) => (entity as any)[k]));
}
