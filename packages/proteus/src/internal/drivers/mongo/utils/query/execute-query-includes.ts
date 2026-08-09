import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { ClientSession, Db, Document, Filter } from "mongodb";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import type { IncludeProjection } from "../../../../utils/query/include-projection.js";
import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../../utils/query/get-relation-metadata.js";
import {
  includeProjection,
  queryStitchKeys,
} from "../../../../utils/query/include-projection.js";
import { compileProjection } from "../compile-projection.js";
import { compileSort } from "../compile-sort.js";
import { resolveCollectionName } from "../resolve-collection-name.js";
import { compileRelationFilter } from "./compile-relation-filter.js";
import { hydrateRelationDocument } from "./hydrate-relation-document.js";
import { documentKey, entityKey } from "./read-document-path.js";
import {
  isJoinTableRelation,
  resolveManyToManyJoin,
  resolveRelationJoin,
} from "./resolve-relation-join.js";

export type MongoQueryIncludesOptions = {
  rootMetadata: EntityMetadata;
  db: Db;
  withDeleted: boolean;
  versionTimestamp: Date | null;
  session?: ClientSession;
  amphora?: IAmphora;
};

/**
 * Load relations with one query per relation instead of one query for
 * everything.
 *
 * That is the whole of what `strategy: "query"` asks for — more round trips,
 * each smaller — and it has to land on the same entities the `$lookup` pipeline
 * produces. `required` never reaches here: the builder forces a required
 * relation onto the join strategy, because excluding a root is something only
 * the query that reads the roots can do.
 */
export const executeMongoQueryIncludes = async <E extends IEntity>(
  entities: Array<E>,
  includes: Array<IncludeSpec>,
  options: MongoQueryIncludesOptions,
): Promise<void> => {
  if (entities.length === 0 || includes.length === 0) return;

  for (const include of includes) {
    const relation = findRelationByKey(options.rootMetadata, include.relation);
    const foreignMetadata = getRelationMetadata(relation);
    const projection = includeProjection(
      include,
      relation,
      foreignMetadata,
      queryStitchKeys,
    );

    const context: RelationContext = {
      include,
      relation,
      foreignMetadata,
      projection,
      isCollection: relation.type === "OneToMany" || relation.type === "ManyToMany",
      filter: compileRelationFilter(include, foreignMetadata, options),
      projected: projection
        ? compileProjection(projection.keys, foreignMetadata)
        : undefined,
      sort: relation.orderBy
        ? (compileSort(relation.orderBy, foreignMetadata) as Document)
        : undefined,
    };

    if (isJoinTableRelation(relation)) {
      await loadManyToManyRelation(entities, context, options);
    } else {
      await loadKeyedRelation(entities, context, options);
    }
  }
};

type RelationContext = {
  include: IncludeSpec;
  relation: MetaRelation;
  foreignMetadata: EntityMetadata;
  projection: IncludeProjection | null;
  isCollection: boolean;
  filter: Filter<Document> | null;
  projected: Document | undefined;
  sort: Document | undefined;
};

const assign = (
  entity: unknown,
  docs: Array<Document>,
  context: RelationContext,
  amphora?: IAmphora,
): void => {
  const related = docs.map((doc) =>
    hydrateRelationDocument(doc, context.foreignMetadata, context.projection, amphora),
  );

  (entity as Dict)[context.include.relation] = context.isCollection
    ? related
    : (related[0] ?? null);
};

const findRelationDocuments = async (
  collection: string,
  condition: Filter<Document>,
  context: RelationContext,
  options: MongoQueryIncludesOptions,
): Promise<Array<Document>> =>
  options.db
    .collection(collection)
    .find(context.filter ? { $and: [condition, context.filter] } : condition, {
      projection: context.projected,
      sort: context.sort,
      ...(options.session ? { session: options.session } : {}),
    })
    .toArray();

/**
 * Build the `IN (…)` a relation query asks its own table with. A single key uses
 * `$in`; a composite one enumerates the tuples, because `$in` over several
 * fields would match any combination of their values rather than the pairs that
 * actually exist.
 */
const buildKeyCondition = (
  docKeys: Array<string>,
  values: Array<Array<unknown>>,
): Filter<Document> =>
  docKeys.length === 1
    ? { [docKeys[0]]: { $in: values.map((tuple) => tuple[0]) } }
    : {
        $or: values.map((tuple) =>
          Object.fromEntries(docKeys.map((key, index) => [key, tuple[index]])),
        ),
      };

/**
 * A relation matched on foreign-key columns, owning or inverse.
 *
 * Both sides read the same way once the join is resolved: a value lives on the
 * root entity under a property key and on the foreign document under a column,
 * so one pass covers a root that carries the foreign key and a foreign row that
 * carries the root's.
 */
const loadKeyedRelation = async <E extends IEntity>(
  entities: Array<E>,
  context: RelationContext,
  options: MongoQueryIncludesOptions,
): Promise<void> => {
  const pairs = resolveRelationJoin(
    context.relation,
    options.rootMetadata,
    context.foreignMetadata,
  );

  const owners = new Map<string, Array<E>>();
  const values: Array<Array<unknown>> = [];

  for (const entity of entities) {
    const resolved = entityKey(
      entity,
      pairs.map((pair) => pair.localKey),
    );

    if (!resolved) {
      assign(entity, [], context, options.amphora);
      continue;
    }

    const bucket = owners.get(resolved.key);
    if (bucket) {
      bucket.push(entity);
    } else {
      owners.set(resolved.key, [entity]);
      values.push(resolved.values);
    }
  }

  if (values.length === 0) return;

  const docs = await findRelationDocuments(
    resolveCollectionName(context.foreignMetadata),
    buildKeyCondition(
      pairs.map((pair) => pair.foreignDoc),
      values,
    ),
    context,
    options,
  );

  const grouped = new Map<string, Array<Document>>();
  for (const doc of docs) {
    const key = documentKey(
      doc,
      pairs.map((pair) => pair.foreignDoc),
    );
    if (key === null) continue;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(doc);
    else grouped.set(key, [doc]);
  }

  for (const [key, owned] of owners) {
    const matched = grouped.get(key) ?? [];
    for (const entity of owned) assign(entity, matched, context, options.amphora);
  }
};

/**
 * A many-to-many: the join collection is read first, then the foreign documents
 * its rows name. Two queries rather than the one the pipeline uses, which is
 * exactly the trade this strategy exists to make.
 *
 * The foreign documents are filtered ONCE and then handed out in the order the
 * query returned them, so a relation `@OrderBy` survives being fanned back out
 * across the roots.
 */
const loadManyToManyRelation = async <E extends IEntity>(
  entities: Array<E>,
  context: RelationContext,
  options: MongoQueryIncludesOptions,
): Promise<void> => {
  const join = resolveManyToManyJoin(
    context.relation,
    options.rootMetadata,
    context.foreignMetadata,
  );

  if (!join) {
    for (const entity of entities) assign(entity, [], context, options.amphora);
    return;
  }

  const rootColumns = join.root.map((entry) => entry.joinColumn);
  const foreignColumns = join.foreign.map((entry) => entry.joinColumn);
  const foreignDocKeys = join.foreign.map((entry) => entry.foreignDoc);

  const owners = new Map<string, Array<E>>();
  const values: Array<Array<unknown>> = [];

  for (const entity of entities) {
    const resolved = entityKey(
      entity,
      join.root.map((entry) => entry.localKey),
    );

    if (!resolved) {
      assign(entity, [], context, options.amphora);
      continue;
    }

    const bucket = owners.get(resolved.key);
    if (bucket) {
      bucket.push(entity);
    } else {
      owners.set(resolved.key, [entity]);
      values.push(resolved.values);
    }
  }

  if (values.length === 0) return;

  const links = await options.db
    .collection(join.collection)
    .find(
      buildKeyCondition(rootColumns, values),
      options.session ? { session: options.session } : {},
    )
    .toArray();

  const targets = new Map<string, Array<unknown>>();
  const linkedByRoot = new Map<string, Set<string>>();

  for (const link of links) {
    const rootKey = documentKey(link, rootColumns);
    const foreignKey = documentKey(link, foreignColumns);
    if (rootKey === null || foreignKey === null) continue;

    if (!targets.has(foreignKey)) {
      targets.set(
        foreignKey,
        foreignColumns.map((column) => link[column]),
      );
    }

    const bucket = linkedByRoot.get(rootKey);
    if (bucket) bucket.add(foreignKey);
    else linkedByRoot.set(rootKey, new Set([foreignKey]));
  }

  const docs =
    targets.size === 0
      ? []
      : await findRelationDocuments(
          resolveCollectionName(context.foreignMetadata),
          buildKeyCondition(foreignDocKeys, [...targets.values()]),
          context,
          options,
        );

  for (const [key, owned] of owners) {
    const linked = linkedByRoot.get(key);
    const matched = linked
      ? docs.filter((doc) => {
          const foreignKey = documentKey(doc, foreignDocKeys);
          return foreignKey !== null && linked.has(foreignKey);
        })
      : [];

    for (const entity of owned) assign(entity, matched, context, options.amphora);
  }
};
