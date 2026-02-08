import { isFunction } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { EntityKitError } from "../errors";
import { IEntity } from "../interfaces";
import {
  EntityKitOptions,
  EntityMetadata,
  GetIncrementFn,
  MetaColumnDecorator,
  MetaRelation,
  MetaSource,
  NamespaceOptions,
  SaveStrategy,
  UpdateStrategy,
} from "../types";
import {
  defaultCloneEntity,
  defaultCreateDocument,
  defaultCreateEntity,
  defaultGenerateEntity,
  defaultRelationFilter,
  defaultUpdateEntity,
  defaultValidateEntity,
  getCollectionName,
  getIncrementName,
  getSaveStrategy,
  globalEntityMetadata,
  removeReadonly,
  verifyReadonly,
} from "../utils";
import { VersionManager } from "./VersionManager";

export class EntityKit<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
  TExtra extends Dict = Dict,
  TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
  TSource extends MetaSource = MetaSource,
> {
  private readonly getNextIncrement: GetIncrementFn | undefined;
  private readonly logger: ILogger | undefined;
  private readonly source: string;
  private readonly versionManager: VersionManager<E>;

  public readonly target: Constructor<E>;
  public readonly isPrimarySource: boolean;
  public readonly metadata: EntityMetadata<TExtra, TDecorator, TSource>;
  public readonly updateStrategy: UpdateStrategy;

  public constructor(options: EntityKitOptions<E>) {
    // Validate required fields
    if (!options.target) {
      throw new EntityKitError("EntityKit requires a target constructor", {
        debug: { options },
      });
    }

    if (!options.source) {
      throw new EntityKitError("EntityKit requires a source parameter", {
        debug: { target: options.target.name },
      });
    }

    // Assign values
    this.target = options.target;
    this.source = options.source;
    this.getNextIncrement = options.getNextIncrement;
    this.logger = options.logger?.child(["EntityKit"]);

    // Attempt metadata retrieval with better error handling
    try {
      this.metadata = globalEntityMetadata.get(this.target);
    } catch (error) {
      throw new EntityKitError(
        `Failed to retrieve metadata for entity "${this.target.name}". Did you forget the @Entity() decorator?`,
        {
          debug: { target: this.target.name },
          error: error instanceof Error ? error : undefined,
        },
      );
    }

    // Initialize version manager
    this.versionManager = new VersionManager<E>(this.metadata);

    // Validate getNextIncrement if entity has increment strategy columns
    const incrementColumns = this.metadata.generated.filter(
      (g) => g.strategy === "increment",
    );

    if (incrementColumns.length > 0 && !this.getNextIncrement) {
      throw new EntityKitError(
        `Entity "${this.target.name}" has @Generated columns with strategy "increment" but no getNextIncrement function was provided`,
        {
          debug: {
            target: this.target.name,
            incrementColumns: incrementColumns.map((g) => g.key),
          },
        },
      );
    }

    this.isPrimarySource = this.calculatePrimarySource();
    this.updateStrategy = this.calculateUpdateStrategy();
  }

  public create(options: O | E = {} as O): E {
    const entity = defaultCreateEntity(this.target, options);

    this.logger?.silly("Created entity", { entity });

    return entity;
  }

  public copy(entity: E): E {
    const copy = defaultCreateEntity(this.target, entity);

    this.logger?.silly("Copied entity", { entity });

    return copy;
  }

  public document(entity: E): Dict {
    const document = defaultCreateDocument(this.target, entity);

    this.logger?.silly("Created document", { document });

    return document;
  }

  public async clone(entity: E): Promise<E> {
    const clone = defaultCloneEntity(this.target, entity);

    // Use version manager
    this.versionManager.prepareForInsert(clone);

    return await this.generate(clone);
  }

  public async insert(entity: E): Promise<E> {
    const copy = this.copy(entity);

    if (!this.isPrimarySource) {
      this.logger?.debug("Skipping default insert for non-primary source", {
        source: this.metadata.primarySource,
      });

      return copy;
    }

    // Use version manager - clean and simple!
    this.versionManager.prepareForInsert(copy);

    return await this.generate(copy);
  }

  public update(entity: E): E {
    const copy = this.copy(entity);

    if (!this.isPrimarySource) {
      this.logger?.debug("Skipping default update for non-primary source", {
        source: this.metadata.primarySource,
      });

      return copy;
    }

    return defaultUpdateEntity(this.target, copy);
  }

  public versionCopy(original: DeepPartial<E>, entity: E): E {
    const updateDate = this.metadata.columns.find(
      (c) => c.decorator === "UpdateDateColumn",
    );
    const versionKey = this.metadata.columns.find(
      (c) => c.decorator === "VersionKeyColumn",
    );
    const versionStartDate = this.metadata.columns.find(
      (c) => c.decorator === "VersionStartDateColumn",
    );
    const versionEndDate = this.metadata.columns.find(
      (c) => c.decorator === "VersionEndDateColumn",
    );

    const copy = this.copy(entity);

    if (updateDate) {
      (copy as any)[updateDate.key] = new Date();
    }

    // Use version manager - increment version for new version record
    this.versionManager.prepareForUpdate(copy);

    if (versionKey) {
      (copy as any)[versionKey.key] = isFunction(versionKey.fallback)
        ? versionKey.fallback()
        : randomUUID();
    }

    if (!versionStartDate) {
      throw new EntityKitError("versionCopy requires @VersionStartDateColumn decorator", {
        debug: { target: this.target.name },
      });
    }

    if (!versionEndDate) {
      throw new EntityKitError("versionCopy requires @VersionEndDateColumn decorator", {
        debug: { target: this.target.name },
      });
    }

    (copy as any)[versionStartDate.key] = original[versionEndDate.key];
    (copy as any)[versionEndDate.key] = null;

    return copy;
  }

  public versionUpdate(entity: E): DeepPartial<E> {
    const versionEndDate = this.metadata.columns.find(
      (c) => c.decorator === "VersionEndDateColumn",
    );

    return {
      [versionEndDate!.key]: (entity as any)[versionEndDate!.key] ?? new Date(),
    } as Partial<E>;
  }

  public getCollectionName(options: NamespaceOptions): string {
    return getCollectionName(this.target, options);
  }

  public getIncrementName(options: NamespaceOptions): string {
    return getIncrementName(this.target, options);
  }

  public getSaveStrategy(entity: E): SaveStrategy {
    return getSaveStrategy(this.target, entity);
  }

  public onInsert(entity: E): void {
    if (!this.isPrimarySource) return;

    for (const hook of this.metadata.hooks.filter((h) => h.decorator === "OnInsert")) {
      hook.callback(entity);
    }
  }

  public onUpdate(entity: E): void {
    if (!this.isPrimarySource) return;

    for (const hook of this.metadata.hooks.filter((h) => h.decorator === "OnUpdate")) {
      hook.callback(entity);
    }
  }

  public onDestroy(entity: E): void {
    if (!this.isPrimarySource) return;

    for (const hook of this.metadata.hooks.filter((h) => h.decorator === "OnDestroy")) {
      hook.callback(entity);
    }
  }

  public relationFilter(relation: MetaRelation, entity: E): Dict {
    return defaultRelationFilter(relation, entity);
  }

  public removeReadonly(entity: E): DeepPartial<E> {
    return removeReadonly(this.target, entity);
  }

  public validate(entity: E): void {
    defaultValidateEntity(this.target, entity);

    this.logger?.silly("Validated entity", { entity });
  }

  public verifyReadonly(entity: DeepPartial<E>): void {
    verifyReadonly(this.target, entity);
  }

  // private

  private calculatePrimarySource(): boolean {
    return (
      Boolean(this.metadata.primarySource) && this.metadata.primarySource === this.source
    );
  }

  private calculateUpdateStrategy(): UpdateStrategy {
    if (!this.metadata.primarySource) {
      this.logger?.warn(
        "@PrimarySource not set on @Entity. Bypassing update strategy calculation and using default.",
      );

      return "update";
    }

    if (this.metadata.columns.find((c) => c.decorator === "VersionKeyColumn")) {
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
      if (result[increment.key] > 0) continue;

      (result as any)[increment.key] = await this.getNextIncrement(increment.key);
    }

    return result;
  }
}
