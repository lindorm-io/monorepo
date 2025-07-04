import { isFunction } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial, Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { IEntity } from "../interfaces";
import {
  EntityKitOptions,
  EntityMetadata,
  GetIncrementFn,
  MetaColumnDecorator,
  MetaSource,
  NamespaceOptions,
  SaveStrategy,
  UpdateStrategy,
} from "../types";
import {
  defaultCloneEntity,
  defaultCreateEntity,
  defaultGenerateEntity,
  defaultUpdateEntity,
  defaultValidateEntity,
  getCollectionName,
  getIncrementName,
  getSaveStrategy,
  globalEntityMetadata,
  removeReadonly,
  verifyReadonly,
} from "../utils";

export class EntityKit<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
  TExtra extends Dict = Dict,
  TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
  TSource extends MetaSource = MetaSource,
> {
  private readonly Entity: Constructor<E>;
  private readonly getNextIncrement: GetIncrementFn | undefined;
  private readonly logger: ILogger | undefined;
  private readonly source: string;

  public readonly isPrimarySource: boolean;
  public readonly metadata: EntityMetadata<TExtra, TDecorator, TSource>;
  public readonly updateStrategy: UpdateStrategy;

  public constructor(options: EntityKitOptions<E>) {
    this.Entity = options.Entity;
    this.getNextIncrement = options.getNextIncrement;
    this.logger = options.logger?.child(["EntityKit"]);
    this.source = options.source;

    this.metadata = globalEntityMetadata.get(this.Entity);
    this.isPrimarySource = this.calculatePrimarySource();
    this.updateStrategy = this.calculateUpdateStrategy();
  }

  public create(options: O | E = {} as O): E {
    const entity = defaultCreateEntity(this.Entity, options);

    this.logger?.silly("Created entity", { entity });

    return entity;
  }

  public copy(entity: E): E {
    const copy = defaultCreateEntity(this.Entity, entity);

    this.logger?.silly("Copied entity", { entity });

    return copy;
  }

  public async clone(entity: E): Promise<E> {
    const version = this.metadata.columns.find((c) => c.decorator === "VersionColumn");

    const clone = defaultCloneEntity(this.Entity, entity);

    if (version) {
      (clone as any)[version.key] = ((clone as any)[version.key] || 0) + 1;
    }

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

    const version = this.metadata.columns.find((c) => c.decorator === "VersionColumn");

    if (version) {
      (copy as any)[version.key] = ((copy as any)[version.key] || 0) + 1;
    }

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

    return defaultUpdateEntity(this.Entity, copy);
  }

  public versionCopy(original: DeepPartial<E>, entity: E): E {
    const updateDate = this.metadata.columns.find(
      (c) => c.decorator === "UpdateDateColumn",
    );
    const version = this.metadata.columns.find((c) => c.decorator === "VersionColumn");
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

    if (version) {
      (copy as any)[version.key] = ((copy as any)[version.key] || 0) + 1;
    }

    if (versionKey) {
      (copy as any)[versionKey.key] = isFunction(versionKey.fallback)
        ? versionKey.fallback()
        : randomUUID();
    }

    (copy as any)[versionStartDate!.key] = original[versionEndDate!.key];
    (copy as any)[versionEndDate!.key] = null;

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
    return getCollectionName(this.Entity, options);
  }

  public getIncrementName(options: NamespaceOptions): string {
    return getIncrementName(this.Entity, options);
  }

  public getSaveStrategy(entity: E): SaveStrategy {
    return getSaveStrategy(this.Entity, entity);
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

  public removeReadonly(entity: E): DeepPartial<E> {
    return removeReadonly(this.Entity, entity);
  }

  public validate(entity: E): void {
    defaultValidateEntity(this.Entity, entity);

    this.logger?.silly("Validated entity", { entity });
  }

  public verifyReadonly(entity: DeepPartial<E>): void {
    verifyReadonly(this.Entity, entity);
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
    const result = defaultGenerateEntity(this.Entity, entity);

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
