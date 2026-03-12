import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { DeepPartial, Dict, Predicate } from "@lindorm/types";
import type {
  IEntity,
  IDeleteQueryBuilder,
  IInsertQueryBuilder,
  IProteusQueryBuilder,
  IUpdateQueryBuilder,
} from "../../../../interfaces";
import type { WriteResult } from "../../../../interfaces/InsertQueryBuilder";
import type { LockMode } from "../../../../types/find-options";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { MemoryStore, MemoryTable } from "../types/memory-store";
import { QueryBuilder } from "../../../../classes/QueryBuilder";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { guardMemoryLockMode } from "../utils/guard-memory-lock-mode";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { Predicated } from "@lindorm/utils";
import { defaultHydrateEntity } from "#internal/entity/utils/default-hydrate-entity";
import { resolvePolymorphicMetadata } from "#internal/entity/utils/resolve-polymorphic-metadata";
import { generateAutoFilters } from "#internal/entity/metadata/auto-filters";
import { flattenEmbeddedCriteria } from "#internal/utils/query/flatten-embedded-criteria";
import { applyOrdering } from "#internal/utils/query/apply-ordering";
import {
  computeAggregateFromValues,
  extractNumericValues,
} from "#internal/utils/query/compute-in-memory-aggregate";
import { resolveFilters } from "#internal/utils/query/resolve-filters";
import { mergeSystemFilterOverrides } from "#internal/utils/query/merge-system-filter-overrides";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError";
import { applyAutoIncrement } from "../utils/memory-auto-increment";
import { checkUniqueConstraints } from "../utils/memory-unique-check";

export class MemoryQueryBuilder<E extends IEntity> extends QueryBuilder<E> {
  private readonly getTable: () => MemoryTable;
  private readonly getStore: () => MemoryStore;
  private readonly namespace: string | null;
  private readonly logger: ILogger | undefined;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    metadata: EntityMetadata,
    getTable: () => MemoryTable,
    getStore: () => MemoryStore,
    namespace: string | null,
    logger?: ILogger,
    amphora?: IAmphora,
  ) {
    super(metadata);
    this.getTable = getTable;
    this.getStore = getStore;
    this.namespace = namespace;
    this.logger = logger;
    this.amphora = amphora;
  }

  // ─── Lock mode ──────────────────────────────────────────────────────

  public lock(mode: LockMode): this {
    guardMemoryLockMode(mode);
    this.state.lock = mode;
    return this;
  }

  // ─── Override raw SQL methods to throw ─────────────────────────────

  public override whereRaw(): this {
    throw new NotSupportedError("whereRaw is not supported by the memory driver");
  }

  public override andWhereRaw(): this {
    throw new NotSupportedError("andWhereRaw is not supported by the memory driver");
  }

  public override orWhereRaw(): this {
    throw new NotSupportedError("orWhereRaw is not supported by the memory driver");
  }

  public override selectRaw(): this {
    throw new NotSupportedError("selectRaw is not supported by the memory driver");
  }

  public override groupBy(): this {
    throw new NotSupportedError("groupBy is not supported by the memory driver");
  }

  public override having(): this {
    throw new NotSupportedError("having is not supported by the memory driver");
  }

  public override andHaving(): this {
    throw new NotSupportedError("andHaving is not supported by the memory driver");
  }

  public override orHaving(): this {
    throw new NotSupportedError("orHaving is not supported by the memory driver");
  }

  public override havingRaw(): this {
    throw new NotSupportedError("havingRaw is not supported by the memory driver");
  }

  public override andHavingRaw(): this {
    throw new NotSupportedError("andHavingRaw is not supported by the memory driver");
  }

  public override orHavingRaw(): this {
    throw new NotSupportedError("orHavingRaw is not supported by the memory driver");
  }

  public override window(): this {
    throw new NotSupportedError("window is not supported by the memory driver");
  }

  // ─── Terminal methods ─────────────────────────────────────────────

  public clone(): IProteusQueryBuilder<E> {
    const cloned = new MemoryQueryBuilder<E>(
      this.metadata,
      this.getTable,
      this.getStore,
      this.namespace,
      this.logger,
      this.amphora,
    );
    cloned.state = this.cloneState();
    return cloned;
  }

  public toQuery(): unknown {
    return { state: this.state, driver: "memory" };
  }

  public async getOne(): Promise<E | null> {
    const rows = await this.resolveRows();
    if (rows.length === 0) return null;
    return this.hydrateRow(rows[0]);
  }

  public async getOneOrFail(): Promise<E> {
    const entity = await this.getOne();
    if (!entity) {
      throw new ProteusRepositoryError(`Entity "${this.metadata.entity.name}" not found`);
    }
    return entity;
  }

  public async getMany(): Promise<Array<E>> {
    const rows = await this.resolveRows();
    return rows.map((row) => this.hydrateRow(row));
  }

  public async getManyAndCount(): Promise<[Array<E>, number]> {
    const allRows = await this.resolveRows(/* skipPagination */ true);
    const totalCount = allRows.length;

    let paginatedRows = allRows;
    if (this.state.skip != null && this.state.skip > 0) {
      paginatedRows = paginatedRows.slice(this.state.skip);
    }
    if (this.state.take != null) {
      paginatedRows = paginatedRows.slice(0, this.state.take);
    }

    const entities = paginatedRows.map((row) => this.hydrateRow(row));
    return [entities, totalCount];
  }

  public async count(): Promise<number> {
    const rows = await this.resolveRows(/* skipPagination */ true);
    return rows.length;
  }

  public async exists(): Promise<boolean> {
    const rows = await this.resolveRows();
    return rows.length > 0;
  }

  public async getRawRows<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<Array<T>> {
    const rows = await this.resolveRows();
    return rows as unknown as Array<T>;
  }

  // ─── Aggregates ───────────────────────────────────────────────────

  public async sum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("sum", field);
  }

  public async average(field: keyof E): Promise<number | null> {
    return this.computeAggregate("avg", field);
  }

  public async minimum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("min", field);
  }

  public async maximum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("max", field);
  }

  // ─── Write builders ───────────────────────────────────────────────

  public insert(): IInsertQueryBuilder<E> {
    return new MemoryInsertBuilder<E>(this.getTable, this.getStore, this.metadata);
  }

  public update(): IUpdateQueryBuilder<E> {
    return new MemoryUpdateBuilder<E>(this.getTable, this.metadata);
  }

  public delete(): IDeleteQueryBuilder<E> {
    return new MemoryDeleteBuilder<E>(
      this.getTable,
      this.getStore,
      this.metadata,
      this.namespace,
      false,
    );
  }

  public softDelete(): IDeleteQueryBuilder<E> {
    return new MemoryDeleteBuilder<E>(
      this.getTable,
      this.getStore,
      this.metadata,
      this.namespace,
      true,
    );
  }

  // ─── Private ──────────────────────────────────────────────────────

  private async resolveRows(skipPagination?: boolean): Promise<Array<Dict>> {
    const table = this.getTable();
    let rows = [...table.values()];

    // Version system filter
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField && !this.state.versionTimestamp && !this.state.withAllVersions) {
      rows = rows.filter((r) => r[versionEndField.key] == null);
    } else if (versionEndField && this.state.versionTimestamp) {
      const ts = this.state.versionTimestamp.getTime();
      const versionStartField = this.metadata.fields.find(
        (f) => f.decorator === "VersionStartDate",
      );
      rows = rows.filter((r) => {
        const start = r[versionStartField?.key ?? "versionStartDate"];
        const end = r[versionEndField.key];
        const startTime =
          start instanceof Date
            ? start.getTime()
            : start
              ? new Date(start as any).getTime()
              : 0;
        const endTime =
          end == null
            ? Infinity
            : end instanceof Date
              ? end.getTime()
              : new Date(end as any).getTime();
        return startTime <= ts && ts < endTime;
      });
    }

    // Apply system + user-defined @Filter predicates (includes __softDelete/__scope)
    // Merge state.filterOverrides (from QB .setFilter()) with system flag overrides
    const qbOverrides =
      Object.keys(this.state.filterOverrides).length > 0
        ? this.state.filterOverrides
        : undefined;
    const systemOverrides = mergeSystemFilterOverrides(
      qbOverrides,
      this.state.withDeleted,
      this.state.withoutScope,
    );
    const resolveMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const metaFilters = resolveFilters(resolveMetaFilters, new Map(), systemOverrides);
    const allFilters = [...metaFilters, ...this.state.resolvedFilters];
    for (const filter of allFilters) {
      rows = Predicated.filter(rows, filter.predicate);
    }

    // Save the post-system-filter base set for OR predicates (F2 fix)
    const baseRows = [...rows];

    // Apply predicates
    for (const entry of this.state.predicates) {
      const flatPredicate = flattenEmbeddedCriteria(entry.predicate, this.metadata);
      if (entry.conjunction === "and") {
        rows = Predicated.filter(rows, flatPredicate);
      } else {
        // OR: union with matching rows from the filtered base set (not raw table)
        const orRows = Predicated.filter(baseRows, flatPredicate);
        const existing = new Set(rows);
        for (const row of orRows) {
          if (!existing.has(row)) {
            rows.push(row);
          }
        }
      }
    }

    // Distinct
    if (this.state.distinct) {
      const seen = new Set<string>();
      rows = rows.filter((r) => {
        const key = JSON.stringify(
          this.state.selections
            ? Object.fromEntries(
                (this.state.selections as Array<string>).map((k) => [k, r[k]]),
              )
            : r,
        );
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Ordering: explicit .orderBy() > @DefaultOrder > none
    const effectiveOrderBy = this.state.orderBy ?? this.metadata.defaultOrder;
    if (effectiveOrderBy) {
      rows = applyOrdering<E>(
        rows,
        effectiveOrderBy as Partial<Record<keyof E, "ASC" | "DESC">>,
      );
    }

    // Pagination
    if (!skipPagination) {
      if (this.state.skip != null && this.state.skip > 0) {
        rows = rows.slice(this.state.skip);
      }
      if (this.state.take != null) {
        rows = rows.slice(0, this.state.take);
      }
    }

    // Select projection
    if (this.state.selections && this.state.selections.length > 0) {
      const keys = this.state.selections as Array<string>;
      rows = rows.map((r) => {
        const projected: Dict = {};
        for (const k of keys) {
          if (k in r) projected[k] = r[k];
        }
        return projected;
      });
    }

    return rows;
  }

  private hydrateRow(row: Dict): E {
    const effectiveMetadata = resolvePolymorphicMetadata(row, this.metadata);
    return defaultHydrateEntity<E>(structuredClone(row), effectiveMetadata, {
      snapshot: true,
      hooks: true,
      amphora: this.amphora,
    });
  }

  private async computeAggregate(
    type: "sum" | "avg" | "min" | "max",
    field: keyof E,
  ): Promise<number | null> {
    const rows = await this.resolveRows(true);
    if (rows.length === 0) return null;
    return computeAggregateFromValues(
      type,
      extractNumericValues(rows as Array<Record<string, unknown>>, field as string),
    );
  }
}

// ─── Write Builders ───────────────────────────────────────────────────

class MemoryInsertBuilder<E extends IEntity> implements IInsertQueryBuilder<E> {
  private readonly getTable: () => MemoryTable;
  private readonly getStore: () => MemoryStore;
  private readonly metadata: EntityMetadata;
  private data: Array<DeepPartial<E>> = [];

  public constructor(
    getTable: () => MemoryTable,
    getStore: () => MemoryStore,
    metadata: EntityMetadata,
  ) {
    this.getTable = getTable;
    this.getStore = getStore;
    this.metadata = metadata;
  }

  public values(data: Array<DeepPartial<E>>): this {
    this.data = data;
    return this;
  }

  public returning(): this {
    // No-op for memory driver — all fields are always returned
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    // QB insert is not supported for joined inheritance children — the multi-table
    // write cannot be expressed in a single VALUES operation.
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB insert is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.insert() instead.`,
      );
    }

    const table = this.getTable();
    const results: Array<E> = [];

    for (const item of this.data) {
      const row: Dict = {};
      for (const field of this.metadata.fields) {
        if (field.key in (item as any)) {
          row[field.key] = (item as any)[field.key];
        }
      }

      // For single-table children, inject the discriminator value so the row
      // can be found by carRepo.find() which filters by __discriminator.
      if (
        this.metadata.inheritance?.strategy === "single-table" &&
        this.metadata.inheritance.discriminatorValue != null
      ) {
        row[this.metadata.inheritance.discriminatorField] =
          this.metadata.inheritance.discriminatorValue;
      }

      applyAutoIncrement(row, this.metadata, this.getStore, true);

      const pk = JSON.stringify(this.metadata.primaryKeys.map((k) => row[k]));

      if (table.has(pk)) {
        throw new MemoryDuplicateKeyError(
          `Duplicate primary key for "${this.metadata.entity.name}": ${pk}`,
          { debug: { entityName: this.metadata.entity.name, primaryKey: pk } },
        );
      }

      checkUniqueConstraints(table, row, this.metadata, null);

      table.set(pk, structuredClone(row));

      const entity = defaultHydrateEntity<E>(
        structuredClone(row),
        resolvePolymorphicMetadata(row, this.metadata),
        { snapshot: false, hooks: false },
      );
      results.push(entity);
    }

    return { rows: results, rowCount: results.length };
  }
}

class MemoryUpdateBuilder<E extends IEntity> implements IUpdateQueryBuilder<E> {
  private readonly getTable: () => MemoryTable;
  private readonly metadata: EntityMetadata;
  private updateData: DeepPartial<E> | null = null;
  private predicates: Array<{ predicate: Predicate<E>; conjunction: "and" | "or" }> = [];

  public constructor(getTable: () => MemoryTable, metadata: EntityMetadata) {
    this.getTable = getTable;
    this.metadata = metadata;
  }

  public set(data: DeepPartial<E>): this {
    this.updateData = data;
    return this;
  }

  public where(criteria: Predicate<E>): this {
    this.predicates = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  public andWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  public orWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  public returning(): this {
    // No-op for memory driver — all fields are always returned
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    // QB update is not supported for joined inheritance children.
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB update is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.update() instead.`,
      );
    }

    if (!this.updateData) return { rows: [], rowCount: 0 };

    const table = this.getTable();
    const results: Array<E> = [];

    // Apply system filters: default-on filters (includes __softDelete) + version
    let rows = [...table.values()];
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField) {
      rows = rows.filter((r) => r[versionEndField.key] == null);
    }
    const updateMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(updateMetaFilters, new Map(), undefined);
    for (const filter of resolved) {
      rows = Predicated.filter(rows, filter.predicate);
    }

    for (const row of rows) {
      if (!this.matchesPredicates(row)) continue;

      for (const [key, value] of Object.entries(
        this.updateData as Record<string, unknown>,
      )) {
        row[key] = value;
      }
      const entity = defaultHydrateEntity<E>(
        structuredClone(row),
        resolvePolymorphicMetadata(row, this.metadata),
        { snapshot: false, hooks: false },
      );
      results.push(entity);
    }

    return { rows: results, rowCount: results.length };
  }

  private matchesPredicates(row: Record<string, unknown>): boolean {
    if (this.predicates.length === 0) return true;
    const flat0 = flattenEmbeddedCriteria(this.predicates[0].predicate, this.metadata);
    let result = Predicated.match(row, flat0);
    for (let i = 1; i < this.predicates.length; i++) {
      const { predicate, conjunction } = this.predicates[i];
      const flatP = flattenEmbeddedCriteria(predicate, this.metadata);
      const m = Predicated.match(row, flatP);
      result = conjunction === "or" ? result || m : result && m;
    }
    return result;
  }
}

class MemoryDeleteBuilder<E extends IEntity> implements IDeleteQueryBuilder<E> {
  private readonly getTable: () => MemoryTable;
  private readonly getStore: () => MemoryStore;
  private readonly metadata: EntityMetadata;
  private readonly namespace: string | null;
  private readonly soft: boolean;
  private predicates: Array<{ predicate: Predicate<E>; conjunction: "and" | "or" }> = [];

  public constructor(
    getTable: () => MemoryTable,
    getStore: () => MemoryStore,
    metadata: EntityMetadata,
    namespace: string | null,
    soft: boolean,
  ) {
    this.getTable = getTable;
    this.getStore = getStore;
    this.metadata = metadata;
    this.namespace = namespace;
    this.soft = soft;
  }

  public where(criteria: Predicate<E>): this {
    this.predicates = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  public andWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  public orWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  public returning(): this {
    // No-op for memory driver — all fields are always returned
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    // QB delete is not supported for joined inheritance children.
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB delete is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.destroy() instead.`,
      );
    }

    const table = this.getTable();
    const results: Array<E> = [];
    const toDelete: string[] = [];

    // Apply system filters: default-on filters (includes __softDelete) + version
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    const deleteField = this.metadata.fields.find((f) => f.decorator === "DeleteDate");
    const deleteMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(deleteMetaFilters, new Map(), undefined);

    for (const [pk, row] of table) {
      // Version system filter
      if (versionEndField && row[versionEndField.key] != null) continue;

      // Apply resolved system filters (includes __softDelete)
      let passesFilters = true;
      for (const filter of resolved) {
        if (!Predicated.match(row, filter.predicate)) {
          passesFilters = false;
          break;
        }
      }
      if (!passesFilters) continue;

      if (!this.matchesPredicates(row)) continue;

      const entity = defaultHydrateEntity<E>(
        structuredClone(row),
        resolvePolymorphicMetadata(row, this.metadata),
        { snapshot: false, hooks: false },
      );
      results.push(entity);

      if (this.soft) {
        if (deleteField) {
          row[deleteField.key] = new Date();
        }
      } else {
        toDelete.push(pk);
      }
    }

    // Clean up collection table rows for hard deletes
    // Note: collection tables are keyed by String(row[parentPkColumn]), NOT by serializePk
    if (toDelete.length > 0 && this.metadata.embeddedLists.length > 0) {
      const store = this.getStore();
      for (const el of this.metadata.embeddedLists) {
        const key = this.namespace ? `${this.namespace}.${el.tableName}` : el.tableName;
        const collectionTable = store.collectionTables.get(key);
        if (!collectionTable) continue;
        for (const pk of toDelete) {
          const row = table.get(pk);
          if (row) {
            collectionTable.delete(String(row[el.parentPkColumn]));
          }
        }
      }
    }

    for (const pk of toDelete) {
      table.delete(pk);
    }

    return { rows: results, rowCount: results.length };
  }

  private matchesPredicates(row: Record<string, unknown>): boolean {
    if (this.predicates.length === 0) return true;
    const flat0 = flattenEmbeddedCriteria(this.predicates[0].predicate, this.metadata);
    let result = Predicated.match(row, flat0);
    for (let i = 1; i < this.predicates.length; i++) {
      const { predicate, conjunction } = this.predicates[i];
      const flatP = flattenEmbeddedCriteria(predicate, this.metadata);
      const m = Predicated.match(row, flatP);
      result = conjunction === "or" ? result || m : result && m;
    }
    return result;
  }
}
