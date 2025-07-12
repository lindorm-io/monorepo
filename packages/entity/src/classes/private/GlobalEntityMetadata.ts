/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { Dict } from "@lindorm/types";
import { EntityMetadataError } from "../../errors";
import {
  EntityMetadata,
  MetaColumn,
  MetaColumnDecorator,
  MetaEntity,
  MetaExtra,
  MetaGenerated,
  MetaHook,
  MetaIndex,
  MetaPrimaryKey,
  MetaPrimarySource,
  MetaRelation,
  MetaSchema,
  MetaSource,
} from "../../types";

type Cache = {
  target: Function;
  metadata: EntityMetadata;
};

type InternalArray =
  | "columns"
  | "entities"
  | "extras"
  | "generated"
  | "hooks"
  | "indexes"
  | "primaryKeys"
  | "primarySources"
  | "relations"
  | "schemas";

const UNIQUE_COLUMNS: Array<MetaColumnDecorator> = [
  // special
  "PrimaryKeyColumn",
  "ScopeColumn",
  "VersionColumn",
  // date
  "CreateDateColumn",
  "UpdateDateColumn",
  "ExpiryDateColumn",
  "DeleteDateColumn",
  // version
  "VersionKeyColumn",
  "VersionStartDateColumn",
  "VersionEndDateColumn",
];

export class GlobalEntityMetadata {
  private readonly cache: Array<Cache>;

  private readonly columns: Array<MetaColumn>;
  private readonly entities: Array<MetaEntity>;
  private readonly extras: Array<MetaExtra>;
  private readonly generated: Array<MetaGenerated>;
  private readonly hooks: Array<MetaHook>;
  private readonly indexes: Array<MetaIndex>;
  private readonly primaryKeys: Array<MetaPrimaryKey>;
  private readonly primarySources: Array<MetaPrimarySource>;
  private readonly relations: Array<MetaRelation>;
  private readonly schemas: Array<MetaSchema>;

  public constructor() {
    this.cache = [];

    this.columns = [];
    this.entities = [];
    this.extras = [];
    this.generated = [];
    this.hooks = [];
    this.indexes = [];
    this.primaryKeys = [];
    this.primarySources = [];
    this.relations = [];
    this.schemas = [];
  }

  // public

  public addColumn<T extends MetaColumnDecorator = MetaColumnDecorator>(
    metadata: MetaColumn<T>,
  ): void {
    this.addMetadata("columns", metadata);
  }

  public addEntity(metadata: MetaEntity): void {
    this.addMetadata("entities", metadata);
  }

  public addExtra<T extends Dict>(metadata: MetaExtra<T>): void {
    this.addMetadata("extras", metadata);
  }

  public addGenerated(metadata: MetaGenerated): void {
    this.addMetadata("generated", metadata);
  }

  public addHook(metadata: MetaHook): void {
    this.addMetadata("hooks", metadata);
  }

  public addIndex(metadata: MetaIndex): void {
    this.addMetadata("indexes", metadata);
  }

  public addPrimaryKey(metadata: MetaPrimaryKey): void {
    this.addMetadata("primaryKeys", metadata);
  }

  public addPrimarySource<T extends MetaSource>(metadata: MetaPrimarySource<T>): void {
    this.addMetadata("primarySources", metadata);
  }

  public addRelation(metadata: MetaRelation): void {
    this.addMetadata("relations", metadata);
  }

  public addSchema(metadata: MetaSchema): void {
    this.addMetadata("schemas", metadata);
  }

  public get<
    TExtra extends Dict = Dict,
    TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
    TSource extends MetaSource = MetaSource,
  >(target: Function): EntityMetadata<TExtra, TDecorator, TSource> {
    const cached = this.getCache<TExtra, TDecorator, TSource>(target);
    if (cached) return cached;

    const [entity] = this.getMeta<MetaEntity>(target, "entities");

    if (!entity) {
      throw new EntityMetadataError("Entity metadata not found", {
        debug: { target: target.name },
      });
    }

    const columns = this.getMeta<MetaColumn<TDecorator>>(target, "columns").map(
      ({ target, ...rest }) => rest,
    );
    const hooks = this.getMeta<MetaHook>(target, "hooks").map(
      ({ target, ...rest }) => rest,
    );
    const extras = this.getMeta<MetaExtra<TExtra>>(target, "extras").map(
      ({ target, ...rest }) => rest,
    );
    const generated = this.getMeta<MetaGenerated>(target, "generated").map(
      ({ target, ...rest }) => rest,
    );
    const indexes = this.getMeta<MetaIndex>(target, "indexes").map(
      ({ target, ...rest }) => rest,
    );
    const primaryK = this.getMeta<MetaPrimaryKey>(target, "primaryKeys").map(
      ({ target, ...rest }) => rest,
    );
    const [primarySource] = this.getMeta<MetaPrimarySource<TSource>>(
      target,
      "primarySources",
    ).map(({ target, ...rest }) => rest);
    const relations = this.getMeta<MetaRelation>(target, "relations").map(
      ({ target, ...rest }) => rest,
    );
    const schemas = this.getMeta<MetaSchema>(target, "schemas").map(
      ({ target: _, schema }) => schema,
    );

    if (columns.find((a) => a.decorator === "VersionKeyColumn")) {
      if (!columns.find((a) => a.decorator === "PrimaryKeyColumn")) {
        throw new EntityMetadataError("Invalid @Entity versioning", {
          details: "@PrimaryKeyColumn not found",
          debug: { target: target.name },
        });
      }

      if (!columns.find((a) => a.decorator === "VersionStartDateColumn")) {
        throw new EntityMetadataError("Invalid @Entity versioning", {
          details: "@VersionStartDateColumn not found",
          debug: { target: target.name },
        });
      }

      if (!columns.find((a) => a.decorator === "VersionEndDateColumn")) {
        throw new EntityMetadataError("Invalid @Entity versioning", {
          details: "@VersionEndDateColumn not found",
          debug: { target: target.name },
        });
      }
    }

    for (const column of columns) {
      if (columns.filter((a) => a.key === column.key).length > 1) {
        throw new EntityMetadataError("Duplicate column metadata", {
          debug: { target: target.name, column: column.key },
        });
      }

      const decorator = column.decorator as MetaColumnDecorator;

      if (
        UNIQUE_COLUMNS.includes(decorator) &&
        columns.filter((a) => a.decorator === decorator).length > 1
      ) {
        throw new EntityMetadataError("Duplicate unique column type", {
          debug: { target: target.name, column: column.key, decorator: decorator },
        });
      }

      if (decorator === "Column" && column.type === "enum" && !column.enum) {
        throw new EntityMetadataError("Invalid @Column enum", {
          details: "@Column enum type requires an enum option",
          debug: { target: target.name, column: column.key },
        });
      }

      if (decorator === "PrimaryKeyColumn") {
        const primaryKey = column;
        const versionKey = columns.find((a) => a.decorator === "VersionKeyColumn");
        const versionStartDate = columns.find(
          (a) => a.decorator === "VersionStartDateColumn",
        );
        const versionEndDate = columns.find(
          (a) => a.decorator === "VersionEndDateColumn",
        );
        const deleteDate = columns.find((a) => a.decorator === "DeleteDateColumn");
        const expiryDate = columns.find((a) => a.decorator === "ExpiryDateColumn");
        const version = columns.find((a) => a.decorator === "VersionColumn");

        if (deleteDate) {
          indexes.push({
            keys: [
              { key: primaryKey.key, direction: "asc" },
              { key: deleteDate.key, direction: "asc" },
            ],
            name: null,
            options: {},
            unique: false,
          });
        }

        if (deleteDate && expiryDate) {
          indexes.push({
            keys: [
              { key: primaryKey.key, direction: "asc" },
              { key: deleteDate.key, direction: "asc" },
              { key: expiryDate.key, direction: "asc" },
            ],
            name: null,
            options: {},
            unique: false,
          });
        }

        if (deleteDate && version) {
          indexes.push({
            keys: [
              { key: primaryKey.key, direction: "asc" },
              { key: deleteDate.key, direction: "asc" },
              { key: version.key, direction: "asc" },
            ],
            name: null,
            options: {},
            unique: false,
          });
        }

        if (deleteDate && expiryDate && version) {
          indexes.push({
            keys: [
              { key: primaryKey.key, direction: "asc" },
              { key: deleteDate.key, direction: "asc" },
              { key: expiryDate.key, direction: "asc" },
              { key: version.key, direction: "asc" },
            ],
            name: null,
            options: {},
            unique: false,
          });
        }

        if (version) {
          indexes.push({
            keys: [
              { key: primaryKey.key, direction: "asc" },
              { key: version.key, direction: "asc" },
            ],
            name: null,
            options: {},
            unique: Boolean(versionKey),
          });
        }

        if (versionStartDate) {
          indexes.push({
            keys: [
              { key: primaryKey.key, direction: "asc" },
              { key: versionStartDate.key, direction: "asc" },
            ],
            name: null,
            options: {},
            unique: false,
          });
        }

        if (versionStartDate && versionEndDate) {
          indexes.push({
            keys: [
              { key: primaryKey.key, direction: "asc" },
              { key: versionStartDate.key, direction: "asc" },
              { key: versionEndDate.key, direction: "asc" },
            ],
            name: null,
            options: {},
            unique: false,
          });
        }
      }
    }

    for (const index of indexes) {
      if (!index.keys.length) {
        throw new EntityMetadataError("Index columns not found", {
          debug: { target: target.name, index: index.name },
        });
      }

      if (indexes.filter((i) => i.name !== null && i.name === index.name).length > 1) {
        throw new EntityMetadataError("Duplicate index name", {
          debug: { target: target.name, index: index.name },
        });
      }

      for (const { key } of index.keys) {
        if (columns.find((a) => a.key === key)) continue;
        throw new EntityMetadataError("Index column not found", {
          debug: { target: target.name, key, index: index.name },
        });
      }

      if (
        indexes.filter(
          (i) =>
            i.keys.length === index.keys.length &&
            i.name === index.name &&
            i.keys.every((k) => index.keys.includes(k)),
        ).length > 1
      ) {
        throw new EntityMetadataError("Duplicate index keys", {
          debug: { target: target.name, index: index.name },
        });
      }
    }

    const primaryKeys = primaryK.reduce((a, c) => [...a, c.key], [] as Array<string>);

    if (!primaryKeys.length) {
      throw new EntityMetadataError("Invalid @Entity", {
        details: "Primary key not found",
        debug: { target: target.name },
      });
    }

    for (const column of primaryKeys) {
      if (columns.find((a) => a.key === column)) continue;
      throw new EntityMetadataError("Primary key column not found", {
        debug: { target: target.name, column },
      });
    }

    for (const generate of generated) {
      if (columns.find((a) => a.key === generate.key)) continue;
      throw new EntityMetadataError("Generate column not found", {
        debug: { target: target.name, column: generate.key },
      });
    }

    const final: EntityMetadata<TExtra, TDecorator, TSource> = {
      columns,
      entity,
      extras,
      generated,
      hooks,
      indexes,
      primaryKeys,
      primarySource: primarySource?.source || null,
      relations,
      schemas,
    };

    this.setCache(target, final);

    return final;
  }

  public find<
    TExtra extends Dict = Dict,
    TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
    TSource extends MetaSource = MetaSource,
  >(name: string): EntityMetadata<TExtra, TDecorator, TSource> | undefined {
    const found = this.entities.find((e) => e.name === name);

    if (!found) return;

    return this.get<TExtra, TDecorator, TSource>(found.target);
  }

  // private

  private addMetadata(key: InternalArray, metadata: any): void {
    this[key].push(metadata);
  }

  private getCache<
    TExtra extends Dict = Dict,
    TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
    TSource extends MetaSource = MetaSource,
  >(target: Function): EntityMetadata<TExtra, TDecorator, TSource> | undefined {
    return this.cache.find((item) => item.target === target)?.metadata as EntityMetadata<
      TExtra,
      TDecorator,
      TSource
    >;
  }

  private getMeta<T>(target: Function, key: InternalArray): Array<T> {
    const collected: Array<any> = [];

    let current: any = target;

    while (current && current !== Function.prototype) {
      collected.push(...this[key].filter((meta: any) => meta.target === current));
      current = Object.getPrototypeOf(current);
    }

    return collected;
  }

  private setCache(target: Function, metadata: EntityMetadata): void {
    this.cache.push({ target, metadata });
  }
}
