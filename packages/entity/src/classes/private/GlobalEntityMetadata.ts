/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { camelCase, snakeCase } from "@lindorm/case";
import { isArray, isObject, isString, isTrue } from "@lindorm/is";
import { Constructor, Dict } from "@lindorm/types";
import { EntityMetadataError } from "../../errors";
import { IEntity } from "../../interfaces";
import {
  EntityMetadata,
  MetaColumnDecorator,
  MetaColumnInternal,
  MetaEntityInternal,
  MetaExtra,
  MetaExtraInternal,
  MetaGeneratedInternal,
  MetaHookInternal,
  MetaIndexInternal,
  MetaPrimaryKeyInternal,
  MetaPrimarySourceInternal,
  MetaRelation,
  MetaRelationInternal,
  MetaSchemaInternal,
  MetaSource,
} from "../../types";
import { calculateJoinKeys, reverseDictValues } from "../../utils/private";

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
  private readonly primaryCache: Map<Function, Omit<EntityMetadata, "relations">>;
  private readonly finalCache: Map<Function, EntityMetadata>;

  private readonly columns: Array<MetaColumnInternal>;
  private readonly entities: Array<MetaEntityInternal>;
  private readonly extras: Array<MetaExtraInternal>;
  private readonly generated: Array<MetaGeneratedInternal>;
  private readonly hooks: Array<MetaHookInternal>;
  private readonly indexes: Array<MetaIndexInternal>;
  private readonly primaryKeys: Array<MetaPrimaryKeyInternal>;
  private readonly primarySources: Array<MetaPrimarySourceInternal>;
  private readonly relations: Array<MetaRelationInternal>;
  private readonly schemas: Array<MetaSchemaInternal>;

  public constructor() {
    this.primaryCache = new Map();
    this.finalCache = new Map();

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
    metadata: MetaColumnInternal<T>,
  ): void {
    this.addMetadata("columns", metadata);
  }

  public addEntity(metadata: MetaEntityInternal): void {
    this.addMetadata("entities", metadata);
  }

  public addExtra<T extends Dict>(metadata: MetaExtraInternal<T>): void {
    this.addMetadata("extras", metadata);
  }

  public addGenerated(metadata: MetaGeneratedInternal): void {
    this.addMetadata("generated", metadata);
  }

  public addHook(metadata: MetaHookInternal): void {
    this.addMetadata("hooks", metadata);
  }

  public addIndex(metadata: MetaIndexInternal): void {
    this.addMetadata("indexes", metadata);
  }

  public addPrimaryKey(metadata: MetaPrimaryKeyInternal): void {
    this.addMetadata("primaryKeys", metadata);
  }

  public addPrimarySource<T extends MetaSource>(
    metadata: MetaPrimarySourceInternal<T>,
  ): void {
    this.addMetadata("primarySources", metadata);
  }

  public addRelation(metadata: MetaRelationInternal): void {
    this.addMetadata("relations", metadata);
  }

  public addSchema(metadata: MetaSchemaInternal): void {
    this.addMetadata("schemas", metadata);
  }

  public get<
    TExtra extends Dict = Dict,
    TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
    TSource extends MetaSource = MetaSource,
  >(target: Function): EntityMetadata<TExtra, TDecorator, TSource> {
    const cached = this.finalCache.get(target) as EntityMetadata<
      TExtra,
      TDecorator,
      TSource
    >;

    if (cached) return cached;

    const primaryMeta = this.primary<TExtra, TDecorator, TSource>(target);

    const found = this.getMeta<MetaRelationInternal>(target, "relations").map(
      ({ target, ...rest }) => rest,
    );

    const relations: Array<MetaRelation> = [];

    for (const relation of found) {
      const foreignMeta = this.primary(relation.foreignConstructor());

      const foreign = this.getMeta<MetaRelationInternal>(
        relation.foreignConstructor(),
        "relations",
      ).find((r) => r.key === relation.foreignKey && r.foreignKey === relation.key);

      if (!foreignMeta) {
        throw new EntityMetadataError("Foreign entity metadata not found", {
          debug: { target: target.name, relation: relation.key },
        });
      }

      if (!foreign) {
        throw new EntityMetadataError("Foreign relation metadata not found", {
          debug: { target: target.name, relation: relation.key },
        });
      }

      if (!relation.joinKeys && !foreign.joinKeys) {
        throw new EntityMetadataError("Join keys not found", {
          debug: { target: target.name, relation: relation.key },
        });
      }

      if (isObject(relation.joinKeys)) {
        for (const key of Object.keys(relation.joinKeys)) {
          const column = primaryMeta.columns.find((c) => c.key === key);
          if (column) continue;
          throw new EntityMetadataError("Join key column not found", {
            debug: { target: target.name, relation: relation.key, key },
          });
        }

        for (const key of Object.values(relation.joinKeys)) {
          const column = foreignMeta.columns.find((c) => c.key === key);
          if (column) continue;
          throw new EntityMetadataError("Foreign join key column not found", {
            debug: { target: target.name, relation: relation.key, key },
          });
        }
      }

      if (isArray(relation.joinKeys)) {
        for (const key of relation.joinKeys) {
          const column = primaryMeta.columns.find((c) => c.key === key);
          if (column) continue;
          throw new EntityMetadataError("Join key column not found", {
            debug: { target: target.name, relation: relation.key, key },
          });
        }
      }

      switch (relation.type) {
        case "ManyToMany":
          // verify join table can at least be inferred
          if (!relation.joinTable && !foreign.joinTable) {
            throw new EntityMetadataError("Join table not found", {
              debug: { target: target.name, relation: relation.key },
            });
          }
          // infer join keys if not array
          if (isArray<string>(relation.joinKeys)) {
            relation.joinKeys = relation.joinKeys.reduce(
              (acc, key) => ({
                ...acc,
                [camelCase(`${primaryMeta.entity.name}_${key}`)]: key,
              }),
              {} as Dict<string>,
            );
          } else if (primaryMeta.target === foreignMeta.target) {
            // self-referencing ManyToMany - use source/target semantics
            const joinKeys: Dict<string> = {};
            for (const key of primaryMeta.primaryKeys) {
              const entityName = primaryMeta.entity.name;
              joinKeys[camelCase(`source_${entityName}_${key}`)] = key;
              joinKeys[camelCase(`target_${entityName}_${key}`)] = key;
            }
            relation.joinKeys = joinKeys;
          } else {
            relation.joinKeys = primaryMeta.primaryKeys.reduce(
              (acc, key) => ({
                ...acc,
                [camelCase(`${primaryMeta.entity.name}_${key}`)]: key,
              }),
              {} as Dict<string>,
            );
          }
          // set join table
          if (isString(relation.joinTable) || isString(foreign.joinTable)) {
            relation.joinTable = relation.joinTable || foreign.joinTable;
          } else if (isTrue(relation.joinTable)) {
            relation.joinTable = snakeCase(
              `${primaryMeta.entity.name}_x_${foreignMeta.entity.name}`,
            );
          } else if (isTrue(foreign.joinTable)) {
            relation.joinTable = snakeCase(
              `${foreignMeta.entity.name}_x_${primaryMeta.entity.name}`,
            );
          }
          // set find keys
          if (primaryMeta.target === foreignMeta.target) {
            // Self-referencing: distinguish by ownership
            const isOwner = Boolean(relation.joinTable);
            const side = isOwner ? "source" : "target";
            relation.findKeys = {};
            for (const key of primaryMeta.primaryKeys) {
              const entityName = primaryMeta.entity.name;
              relation.findKeys[camelCase(`${side}_${entityName}_${key}`)] = key;
            }
          } else {
            relation.findKeys = relation.joinKeys;
          }
          break;

        case "ManyToOne":
          // infer join keys if not object
          if (isTrue(relation.joinKeys)) {
            relation.joinKeys = calculateJoinKeys(relation, foreignMeta);
          }
          // set find keys
          if (isObject(relation.joinKeys)) {
            relation.findKeys = reverseDictValues(relation.joinKeys as Dict<string>);
          } else {
            relation.findKeys = reverseDictValues(
              calculateJoinKeys(relation, foreignMeta),
            );
          }
          break;

        case "OneToMany":
          // set find keys
          if (isObject(foreign.joinKeys)) {
            relation.findKeys = foreign.joinKeys;
          } else {
            relation.findKeys = calculateJoinKeys(foreign, primaryMeta);
          }
          break;

        case "OneToOne":
          // verify join keys can be inferred
          if (relation.joinKeys && foreign.joinKeys) {
            throw new EntityMetadataError("Join keys cannot be set on both decorators", {
              debug: { target: target.name, relation: relation.key },
            });
          }
          // infer join keys if not object
          if (isTrue(relation.joinKeys)) {
            relation.joinKeys = calculateJoinKeys(relation, foreignMeta);
          }
          // set find keys
          if (isObject(relation.joinKeys)) {
            relation.findKeys = reverseDictValues(relation.joinKeys as Dict<string>);
          } else if (isTrue(relation.joinKeys)) {
            relation.findKeys = reverseDictValues(
              calculateJoinKeys(relation, foreignMeta),
            );
          } else if (isObject(foreign.joinKeys)) {
            relation.findKeys = foreign.joinKeys;
          } else if (isTrue(foreign.joinKeys)) {
            relation.findKeys = calculateJoinKeys(foreign, primaryMeta);
          } else {
            relation.findKeys = null;
          }
          break;
      }

      if (!isObject(relation.joinKeys)) {
        relation.joinKeys = null;
      }

      if (!isObject(relation.findKeys)) {
        relation.findKeys = null;
      }

      if (!relation.findKeys) {
        throw new EntityMetadataError("Unable to calculate find keys for relation", {
          debug: { target: target.name, relation: relation.key },
        });
      }

      relations.push(relation as MetaRelation);
    }

    const final: EntityMetadata<TExtra, TDecorator, TSource> = {
      ...primaryMeta,
      relations,
    };

    // cache the result
    this.finalCache.set(target, final);

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

  private primary<
    TExtra extends Dict = Dict,
    TDecorator extends MetaColumnDecorator = MetaColumnDecorator,
    TSource extends MetaSource = MetaSource,
  >(target: Function): Omit<EntityMetadata<TExtra, TDecorator, TSource>, "relations"> {
    const cached = this.primaryCache.get(target) as Omit<
      EntityMetadata<TExtra, TDecorator, TSource>,
      "relations"
    >;

    if (cached) return cached;

    const [entity] = this.getMeta<MetaEntityInternal>(target, "entities").map(
      ({ target, ...rest }) => rest,
    );

    if (!entity) {
      throw new EntityMetadataError("Entity metadata not found", {
        debug: { target: target.name },
      });
    }

    const columns = this.getMeta<MetaColumnInternal<TDecorator>>(target, "columns").map(
      ({ target, ...rest }) => rest,
    );
    const hooks = this.getMeta<MetaHookInternal>(target, "hooks").map(
      ({ target, ...rest }) => rest,
    );
    const extras = this.getMeta<MetaExtraInternal<TExtra>>(target, "extras").map(
      ({ target, ...rest }) => rest,
    );
    const generated = this.getMeta<MetaGeneratedInternal>(target, "generated").map(
      ({ target, ...rest }) => rest,
    );
    const indexes = this.getMeta<MetaIndexInternal>(target, "indexes").map(
      ({ target, ...rest }) => rest,
    );
    const primaryK = this.getMeta<MetaPrimaryKeyInternal>(target, "primaryKeys").map(
      ({ target, ...rest }) => rest,
    );
    const [primarySource] = this.getMeta<MetaPrimarySourceInternal<TSource>>(
      target,
      "primarySources",
    ).map(({ target, ...rest }) => rest);
    const schemas = this.getMeta<MetaSchemaInternal>(target, "schemas").map(
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

      const decorator = column.decorator;

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
      const column = columns.find((a) => a.key === generate.key);
      if (!column) {
        throw new EntityMetadataError("Generate column not found", {
          debug: { target: target.name, column: generate.key },
        });
      }

      // Infer column type from @Generated strategy when @Column has no explicit type
      if (column.type === null) {
        switch (generate.strategy) {
          case "increment":
          case "integer":
            column.type = "integer";
            break;
          case "float":
            column.type = "float";
            break;
          case "uuid":
            column.type = "uuid";
            break;
          case "string":
            column.type = "string";
            break;
          case "date":
            column.type = "date";
            break;
        }
      }
    }

    const final: Omit<EntityMetadata<TExtra, TDecorator, TSource>, "relations"> = {
      target: target as Constructor<IEntity>,
      columns,
      entity,
      extras: extras as Array<MetaExtra<TExtra>>,
      generated,
      hooks,
      indexes,
      primaryKeys,
      primarySource: primarySource?.source || null,
      schemas,
    };

    this.primaryCache.set(target, final);

    return final;
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
}
