import { isFunction } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, DeepPartial, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import type { IEntity } from "../../../interfaces/index.js";
import type {
  NamespaceOptions,
  SaveStrategy,
  ScopedName,
  UpdateStrategy,
} from "../../types/types.js";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";
import type {
  EntityMetadata,
  MetaFieldDecorator,
  MetaRelation,
} from "../types/metadata.js";
import type { EntityManagerOptions, GetIncrementFn } from "../types/entity-manager.js";
import type { ProteusHookMeta } from "../../../types/proteus-hook-meta.js";
import { defaultCloneEntity } from "../utils/default-clone-entity.js";
import { defaultCreateEntity } from "../utils/default-create-entity.js";
import { defaultCreateRaw } from "../utils/default-create-raw.js";
import { defaultGenerateEntity } from "../utils/default-generate-entity.js";
import { defaultRelationFilter } from "../utils/default-relation-filter.js";
import { defaultUpdateEntity } from "../utils/default-update-entity.js";
import { defaultValidateEntity } from "../utils/default-validate-entity.js";
import { getEntityName } from "../utils/get-entity-name.js";
import { getIncrementName } from "../utils/get-increment-name.js";
import { getSaveStrategy } from "../utils/get-save-strategy.js";
import { removeReadonlyDataFields } from "../utils/remove-readonly-data-fields.js";
import { runHooksAsync } from "../utils/run-hooks-async.js";
import { runHooksSync } from "../utils/run-hooks-sync.js";
import { verifyReadonly } from "../utils/verify-readonly.js";
import { VersionManager } from "./VersionManager.js";

export class EntityManager<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
  TExtra extends Dict = Dict,
  TDecorator extends MetaFieldDecorator = MetaFieldDecorator,
> {
  private readonly meta: ProteusHookMeta | undefined;
  private readonly getNextIncrement: GetIncrementFn | undefined;
  private readonly logger: ILogger | undefined;
  private readonly driver: string;
  private readonly versionManager: VersionManager<E>;

  public readonly target: Constructor<E>;
  public readonly metadata: EntityMetadata<TExtra, TDecorator>;
  public readonly updateStrategy: UpdateStrategy;

  public constructor(options: EntityManagerOptions<E>) {
    if (!options.target) {
      throw new EntityManagerError("EntityManager requires a target constructor", {
        debug: { options },
      });
    }

    if (!options.driver) {
      throw new EntityManagerError("EntityManager requires a driver parameter", {
        debug: { target: options.target.name },
      });
    }

    this.target = options.target;
    this.meta = options.meta;
    this.driver = options.driver;
    this.getNextIncrement = options.getNextIncrement;
    this.logger = options.logger?.child(["EntityManager"]);

    try {
      this.metadata = getEntityMetadata(this.target);
    } catch (error) {
      throw new EntityManagerError(
        `Failed to retrieve metadata for entity "${this.target.name}". Did you forget the
  @Entity() decorator?`,
        {
          debug: { target: this.target.name },
          error: error instanceof Error ? error : undefined,
        },
      );
    }

    this.versionManager = new VersionManager<E>(this.metadata);

    const incrementFields = this.metadata.generated.filter(
      (g) => g.strategy === "increment",
    );

    if (
      incrementFields.length > 0 &&
      !this.getNextIncrement &&
      this.driver !== "postgres"
    ) {
      throw new EntityManagerError(
        `Entity "${this.target.name}" has @Generated fields with strategy "increment" but no getNextIncrement function was provided`,
        {
          debug: {
            target: this.target.name,
            incrementFields: incrementFields.map((g) => g.key),
          },
        },
      );
    }

    this.updateStrategy = this.calculateUpdateStrategy();
  }

  public create(options: O | E = {} as O): E {
    const entity = defaultCreateEntity(this.target, options);
    runHooksSync("OnCreate", this.metadata.hooks, entity, this.meta);

    this.logger?.silly("Created entity", { entity });

    return entity;
  }

  public copy(entity: E): E {
    const copy = defaultCreateEntity(this.target, entity);
    runHooksSync("OnCreate", this.metadata.hooks, copy, this.meta);

    this.logger?.silly("Copied entity", { entity });

    return copy;
  }

  public document(entity: E): Dict {
    const document = defaultCreateRaw(this.target, entity);

    this.logger?.silly("Created document", { document });

    return document;
  }

  public async clone(entity: E): Promise<E> {
    const clone = defaultCloneEntity(this.target, entity);
    runHooksSync("OnCreate", this.metadata.hooks, clone, this.meta);

    // Set UpdateDate on clone (same as insert — CreateDate is handled by @Generated("date"))
    const updateDate = this.metadata.fields.find((f) => f.decorator === "UpdateDate");
    if (updateDate && (clone as any)[updateDate.key] == null) {
      (clone as any)[updateDate.key] = new Date();
    }

    this.versionManager.prepareForInsert(clone);

    return await this.generate(clone);
  }

  public async insert(entity: E): Promise<E> {
    const copy = this.copy(entity);

    // Set UpdateDate on first insert (CreateDate is handled by @Generated("date"))
    const updateDate = this.metadata.fields.find((f) => f.decorator === "UpdateDate");
    if (updateDate && (copy as any)[updateDate.key] == null) {
      (copy as any)[updateDate.key] = new Date();
    }

    this.versionManager.prepareForInsert(copy);

    return await this.generate(copy);
  }

  public update(entity: E): E {
    const copy = this.copy(entity);

    return defaultUpdateEntity(this.target, copy);
  }

  public versionCopy(original: DeepPartial<E>, entity: E): E {
    const updateDate = this.metadata.fields.find((f) => f.decorator === "UpdateDate");
    const versionKey =
      this.metadata.versionKeys.length > 0
        ? this.metadata.fields.find((f) => this.metadata.versionKeys.includes(f.key))
        : undefined;
    const versionStartDate = this.metadata.fields.find(
      (f) => f.decorator === "VersionStartDate",
    );
    const versionEndDate = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );

    const copy = this.copy(entity);

    if (updateDate) {
      (copy as any)[updateDate.key] = new Date();
    }

    this.versionManager.prepareForUpdate(copy);

    if (versionKey) {
      (copy as any)[versionKey.key] = isFunction(versionKey.default)
        ? versionKey.default()
        : randomUUID();
    }

    if (!versionStartDate) {
      throw new EntityManagerError("versionCopy requires @VersionStartDate decorator", {
        debug: { target: this.target.name },
      });
    }

    if (!versionEndDate) {
      throw new EntityManagerError("versionCopy requires @VersionEndDate decorator", {
        debug: { target: this.target.name },
      });
    }

    (copy as any)[versionStartDate.key] = original[versionEndDate.key] ?? new Date();
    (copy as any)[versionEndDate.key] = null;

    return copy;
  }

  public versionUpdate(entity: E): DeepPartial<E> {
    const versionEndDate = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );

    if (!versionEndDate) {
      throw new EntityManagerError("versionUpdate requires @VersionEndDate decorator", {
        debug: { target: this.target.name },
      });
    }

    return {
      [versionEndDate.key]: (entity as any)[versionEndDate.key] ?? new Date(),
    } as Partial<E>;
  }

  public getEntityName(options: NamespaceOptions): ScopedName {
    return getEntityName(this.target, options);
  }

  public getIncrementName(options: NamespaceOptions): ScopedName {
    return getIncrementName(this.target, options);
  }

  public getSaveStrategy(entity: E): SaveStrategy {
    return getSaveStrategy(this.target, entity);
  }

  // hooks — before (async, pre-DB-write)

  public async beforeInsert(entity: E): Promise<void> {
    await runHooksAsync("BeforeInsert", this.metadata.hooks, entity, this.meta);
  }

  public async beforeUpdate(entity: E): Promise<void> {
    await runHooksAsync("BeforeUpdate", this.metadata.hooks, entity, this.meta);
  }

  public async beforeSave(entity: E): Promise<void> {
    await runHooksAsync("BeforeSave", this.metadata.hooks, entity, this.meta);
  }

  public async beforeDestroy(entity: E): Promise<void> {
    await runHooksAsync("BeforeDestroy", this.metadata.hooks, entity, this.meta);
  }

  // hooks — after (async, post-DB-write)

  public async afterLoad(entity: E): Promise<void> {
    await runHooksAsync("AfterLoad", this.metadata.hooks, entity, this.meta);
  }

  public async afterInsert(entity: E): Promise<void> {
    await runHooksAsync("AfterInsert", this.metadata.hooks, entity, this.meta);
  }

  public async afterUpdate(entity: E): Promise<void> {
    await runHooksAsync("AfterUpdate", this.metadata.hooks, entity, this.meta);
  }

  public async afterSave(entity: E): Promise<void> {
    await runHooksAsync("AfterSave", this.metadata.hooks, entity, this.meta);
  }

  public async afterDestroy(entity: E): Promise<void> {
    await runHooksAsync("AfterDestroy", this.metadata.hooks, entity, this.meta);
  }

  // hooks — soft delete/restore (async)

  public async beforeSoftDestroy(entity: E): Promise<void> {
    await runHooksAsync("BeforeSoftDestroy", this.metadata.hooks, entity, this.meta);
  }

  public async afterSoftDestroy(entity: E): Promise<void> {
    await runHooksAsync("AfterSoftDestroy", this.metadata.hooks, entity, this.meta);
  }

  public async beforeRestore(entity: E): Promise<void> {
    await runHooksAsync("BeforeRestore", this.metadata.hooks, entity, this.meta);
  }

  public async afterRestore(entity: E): Promise<void> {
    await runHooksAsync("AfterRestore", this.metadata.hooks, entity, this.meta);
  }

  public relationFilter(relation: MetaRelation, entity: E): Dict {
    return defaultRelationFilter(relation, entity);
  }

  public removeReadonly(entity: E): DeepPartial<E> {
    return removeReadonlyDataFields(this.target, entity);
  }

  public validate(entity: E): void {
    defaultValidateEntity(this.target, entity);
    runHooksSync("OnValidate", this.metadata.hooks, entity, this.meta);

    this.logger?.silly("Validated entity", { entity });
  }

  public verifyReadonly(entity: DeepPartial<E>): void {
    verifyReadonly(this.target, entity);
  }

  // private

  private calculateUpdateStrategy(): UpdateStrategy {
    if (this.metadata.versionKeys.length > 0) {
      return "version";
    }

    return "update";
  }

  private async generate(entity: DeepPartial<E>): Promise<E> {
    const result = defaultGenerateEntity(this.target, entity);

    if (!isFunction(this.getNextIncrement)) {
      return result;
    }

    const increments = this.metadata.generated.filter((g) => g.strategy === "increment");

    for (const increment of increments) {
      if (result[increment.key] != null) continue;

      (result as any)[increment.key] = await this.getNextIncrement(increment.key);
    }

    return result;
  }
}
