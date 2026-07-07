import type { DeepPartial, Predicate } from "@lindorm/types";
import type { DeleteOptions, FindOptions } from "../../types/index.js";
import type { IEntity } from "../../interfaces/Entity.js";
import type { QueryScope, ReadOnlyOperation } from "../entity/types/metadata.js";

export interface IRepositoryExecutor<E extends IEntity> {
  executeInsert(entity: E): Promise<E>;
  /**
   * Persist an existing row. `operation` selects the read-only scope to honour:
   * `"update"` (default) skips fields read-only on update; `"upsert"` skips fields
   * read-only on upsert (preserving their stored value on a conflict). Executors
   * that overwrite wholesale (e.g. redis) ignore this and rely on the repository
   * pre-merging the retained values instead.
   */
  executeUpdate(entity: E, operation?: ReadOnlyOperation): Promise<E>;
  executeDelete(criteria: Predicate<E>, options?: DeleteOptions): Promise<void>;
  executeSoftDelete(criteria: Predicate<E>): Promise<void>;
  executeRestore(criteria: Predicate<E>): Promise<void>;
  executeDeleteExpired(): Promise<void>;
  executeTtl(criteria: Predicate<E>): Promise<number | null>;
  executeFind(
    criteria: Predicate<E>,
    options: FindOptions<E>,
    operationScope?: QueryScope,
  ): Promise<Array<E>>;
  executeCount(criteria: Predicate<E>, options: FindOptions<E>): Promise<number>;
  executeExists(criteria: Predicate<E>): Promise<boolean>;
  executeIncrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void>;
  executeDecrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void>;
  executeInsertBulk(entities: Array<E>): Promise<Array<E>>;
  executeUpdateMany(
    criteria: Predicate<E>,
    update: DeepPartial<E>,
    options?: { systemFilters?: boolean },
  ): Promise<number>;
}
