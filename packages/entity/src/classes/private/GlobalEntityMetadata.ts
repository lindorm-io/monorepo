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
  MetaSchema,
  MetaSource,
  MetaUnique,
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
  | "schemas"
  | "uniques";

const UNIQUE_COLUMNS: Array<MetaColumnDecorator> = [
  // special
  "PrimaryKeyColumn",
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
  private readonly schemas: Array<MetaSchema>;
  private readonly uniques: Array<MetaUnique>;

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
    this.schemas = [];
    this.uniques = [];
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

  public addSchema(metadata: MetaSchema): void {
    this.addMetadata("schemas", metadata);
  }

  public addUnique(metadata: MetaUnique): void {
    this.addMetadata("uniques", metadata);
  }

  public get<
    TExtra extends Dict = Dict,
    TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
    TSource extends MetaSource = MetaSource,
  >(target: Function): EntityMetadata<TExtra, TDecorator, TSource> {
    const cached = this.getCache<TExtra, TDecorator, TSource>(target);
    if (cached) return cached;

    const [foundEntity] = this.getMeta<MetaEntity>(target, "entities");

    if (!foundEntity) {
      throw new EntityMetadataError("Entity metadata not found", {
        debug: { Entity: target.name },
      });
    }

    const { target: _, ...entity } = foundEntity;

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
    const schemas = this.getMeta<MetaSchema>(target, "schemas").map(
      ({ target: _, schema }) => schema,
    );
    const uniques = this.getMeta<MetaUnique>(target, "uniques").map(
      ({ target, ...rest }) => rest,
    );

    if (columns.find((a) => a.decorator === "VersionKeyColumn")) {
      if (!columns.find((a) => a.decorator === "PrimaryKeyColumn")) {
        throw new EntityMetadataError("Invalid @Entity versioning", {
          details: "@PrimaryKeyColumn not found",
          debug: { Entity: target.name },
        });
      }

      if (!columns.find((a) => a.decorator === "VersionStartDateColumn")) {
        throw new EntityMetadataError("Invalid @Entity versioning", {
          details: "@VersionStartDateColumn not found",
          debug: { Entity: target.name },
        });
      }

      if (!columns.find((a) => a.decorator === "VersionEndDateColumn")) {
        throw new EntityMetadataError("Invalid @Entity versioning", {
          details: "@VersionEndDateColumn not found",
          debug: { Entity: target.name },
        });
      }
    }

    for (const column of columns) {
      if (columns.filter((a) => a.key === column.key).length > 1) {
        throw new EntityMetadataError("Duplicate column metadata", {
          debug: { Entity: target.name, column: column.key },
        });
      }

      const decorator = column.decorator as MetaColumnDecorator;

      if (
        UNIQUE_COLUMNS.includes(decorator) &&
        columns.filter((a) => a.decorator === decorator).length > 1
      ) {
        throw new EntityMetadataError("Duplicate unique column type", {
          debug: { Entity: target.name, column: column.key, decorator: decorator },
        });
      }

      if (decorator === "PrimaryKeyColumn") {
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
            index: [column.key, deleteDate.key].reduce(
              (acc, key) => ({ ...acc, [key]: "asc" }),
              {},
            ),
            name: null,
            options: {},
          });
        }

        if (deleteDate && expiryDate) {
          indexes.push({
            index: [column.key, deleteDate.key, expiryDate.key].reduce(
              (acc, key) => ({ ...acc, [key]: "asc" }),
              {},
            ),
            name: null,
            options: {},
          });
        }

        if (deleteDate && version) {
          indexes.push({
            index: [column.key, deleteDate.key, version.key].reduce(
              (acc, key) => ({ ...acc, [key]: "asc" }),
              {},
            ),
            name: null,
            options: {},
          });
        }

        if (deleteDate && expiryDate && version) {
          indexes.push({
            index: [column.key, deleteDate.key, expiryDate.key, version.key].reduce(
              (acc, key) => ({ ...acc, [key]: "asc" }),
              {},
            ),
            name: null,
            options: {},
          });
        }

        if (version && versionKey) {
          uniques.push({
            keys: [column.key, version.key],
            name: null,
          });
        } else if (version) {
          indexes.push({
            index: [column.key, version.key].reduce(
              (acc, key) => ({ ...acc, [key]: "asc" }),
              {},
            ),
            name: null,
            options: {},
          });
        }

        if (versionStartDate) {
          indexes.push({
            index: [column.key, versionStartDate.key].reduce(
              (acc, key) => ({ ...acc, [key]: "asc" }),
              {},
            ),
            name: null,
            options: {},
          });
        }

        if (versionStartDate && versionEndDate) {
          indexes.push({
            index: [column.key, versionStartDate.key, versionEndDate.key].reduce(
              (acc, key) => ({ ...acc, [key]: "asc" }),
              {},
            ),
            name: null,
            options: {},
          });
        }
      }
    }

    for (const index of indexes) {
      if (!Object.keys(index.index).length) {
        throw new EntityMetadataError("Index columns not found", {
          debug: { Entity: target.name, index: index.name },
        });
      }

      if (indexes.filter((i) => i.name !== null && i.name === index.name).length > 1) {
        throw new EntityMetadataError("Duplicate index name", {
          debug: { Entity: target.name, index: index.name },
        });
      }

      for (const column of Object.keys(index.index)) {
        if (columns.find((a) => a.key === column)) continue;
        throw new EntityMetadataError("Index column not found", {
          debug: { Entity: target.name, column, index: index.name },
        });
      }
    }

    const primaryKeys = primaryK.reduce((a, c) => [...a, c.key], [] as Array<string>);

    if (!primaryKeys.length) {
      throw new EntityMetadataError("Invalid @Entity", {
        details: "Primary key not found",
        debug: { Entity: target.name },
      });
    }

    for (const column of primaryKeys) {
      if (columns.find((a) => a.key === column)) continue;
      throw new EntityMetadataError("Primary key column not found", {
        debug: { Entity: target.name, column },
      });
    }

    for (const generate of generated) {
      if (columns.find((a) => a.key === generate.key)) continue;
      throw new EntityMetadataError("Generate column not found", {
        debug: { Entity: target.name, column: generate.key },
      });
    }

    for (const unique of uniques) {
      if (!unique.keys.length) {
        throw new EntityMetadataError("Unique keys not found", {
          debug: { Entity: target.name, unique: unique.name },
        });
      }

      if (uniques.filter((u) => u.name !== null && u.name === unique.name).length > 1) {
        throw new EntityMetadataError("Duplicate unique name", {
          debug: { Entity: target.name, unique: unique.name },
        });
      }

      for (const column of unique.keys) {
        if (columns.find((a) => a.key === column)) continue;
        throw new EntityMetadataError("Unique column not found", {
          debug: { Entity: target.name, column, unique: unique.name },
        });
      }

      if (
        uniques.filter(
          (u) =>
            u.keys.length === unique.keys.length &&
            u.name === unique.name &&
            u.keys.every((k) => unique.keys.includes(k)),
        ).length > 1
      ) {
        throw new EntityMetadataError("Duplicate unique keys", {
          debug: { Entity: target.name, unique: unique.name },
        });
      }
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
      schemas,
      uniques,
    };

    this.setCache(target, final);

    return final;
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
