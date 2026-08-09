import { isArray, isObject } from "@lindorm/is";
import type { Condition } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import { uniq } from "@lindorm/utils";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { projectedForeignKeys } from "../query/include-projection.js";

export const guardDeleteDateField = (metadata: EntityMetadata, method: string): void => {
  const field = metadata.fields.find((f) => f.decorator === "DeleteDate");
  if (!field) {
    throw new ProteusRepositoryError(
      `${method}() requires @DeleteDateField on "${metadata.entity.name}"`,
      {
        code: "missing_delete_date_field",
        title: "Missing Delete Date Field",
        details: "Add a @DeleteDateField to the entity to enable soft-delete operations.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const guardExpiryDateField = (metadata: EntityMetadata, method: string): void => {
  const field = metadata.fields.find((f) => f.decorator === "ExpiryDate");
  if (!field) {
    throw new ProteusRepositoryError(
      `${method}() requires @ExpiryDateField on "${metadata.entity.name}"`,
      {
        code: "missing_expiry_date_field",
        title: "Missing Expiry Date Field",
        details:
          "Add an @ExpiryDateField to the entity to enable expiry-based operations.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const guardVersionFields = (metadata: EntityMetadata, method: string): void => {
  const startDate = metadata.fields.find((f) => f.decorator === "VersionStartDate");
  const endDate = metadata.fields.find((f) => f.decorator === "VersionEndDate");
  if (!startDate || !endDate) {
    throw new ProteusRepositoryError(
      `${method}() requires @VersionStartDateField and @VersionEndDateField on "${metadata.entity.name}"`,
      {
        code: "missing_version_fields",
        title: "Missing Version Fields",
        details:
          "Add both @VersionStartDateField and @VersionEndDateField to the entity to enable versioned operations.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const guardUpsertBlocked = (metadata: EntityMetadata): void => {
  const hasVersionStartDate = metadata.fields.some(
    (f) => f.decorator === "VersionStartDate",
  );
  const hasVersionEndDate = metadata.fields.some((f) => f.decorator === "VersionEndDate");

  if (hasVersionStartDate || hasVersionEndDate) {
    throw new ProteusRepositoryError(
      `upsert() is not supported on versioned entity "${metadata.entity.name}"`,
      {
        code: "upsert_not_supported",
        title: "Upsert Not Supported",
        details:
          "Upsert is not available on versioned entities; use insert or update instead.",
        debug: { entityName: metadata.entity.name },
      },
    );
  }

  const hasIncrementPk = metadata.generated.some(
    (g) => g.strategy === "increment" && metadata.primaryKeys.includes(g.key),
  );

  if (hasIncrementPk) {
    throw new ProteusRepositoryError(
      `upsert() is not supported on entity "${metadata.entity.name}" with auto-increment primary key`,
      {
        code: "upsert_not_supported",
        title: "Upsert Not Supported",
        details:
          "Upsert is not available on entities with an auto-increment primary key; use insert or update instead.",
        debug: { entityName: metadata.entity.name },
      },
    );
  }
};

export const guardAppendOnly = (metadata: EntityMetadata, method: string): void => {
  if (metadata.appendOnly) {
    throw new ProteusRepositoryError(
      `Cannot ${method} an append-only entity "${metadata.entity.name}"`,
      {
        code: "append_only_violation",
        title: "Append Only Violation",
        details:
          "Append-only entities permit inserts only; update and delete operations are not allowed.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const guardEncryptedField = (
  metadata: EntityMetadata,
  property: string,
  method: string,
): void => {
  const field = metadata.fields.find((f) => f.key === property);
  if (field?.encrypted) {
    throw new ProteusRepositoryError(
      `Cannot ${method} encrypted field "${property}" on entity "${metadata.entity.name}"`,
      {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details: `The field "${property}" is stored as ciphertext, so ${method}() has no value of the declared type to work with. Read the entities, compute over the decrypted values in application code, and write any result back.`,
        debug: { entityName: metadata.entity.name, property, method },
      },
    );
  }
};

/**
 * The logical operators that appear as criteria KEYS. Everything else
 * `$`-prefixed is a FIELD-level operator and only ever shows up inside a
 * field's value (`{ name: { $like: "x" } }`), never as a criteria key.
 *
 * `Condition<T>` spells its logical operators as its only `$`-prefixed keys —
 * the rest of the shape is mapped from `T` — so extracting them from the type
 * pins this list to `@lindorm/match`. The `Record` makes it exact in BOTH
 * directions: a fourth operator added there fails this compile as a missing
 * property, a stale one as an excess property.
 */
type LogicalOperator = Extract<keyof Condition<{ _: never }>, `$${string}`>;

const LOGICAL_OPERATOR_MAP: Record<LogicalOperator, true> = {
  $and: true,
  $or: true,
  $not: true,
};

export const CRITERIA_LOGICAL_OPERATORS = Object.keys(
  LOGICAL_OPERATOR_MAP,
) as Array<LogicalOperator>;

const isLogicalOperator = (key: string): boolean =>
  (CRITERIA_LOGICAL_OPERATORS as Array<string>).includes(key);

/**
 * A value is an operator object — `{ $gt: 5 }` — rather than a nested predicate
 * once it carries any non-logical `$` key. Mirrors `flattenEmbeddedCriteria`,
 * which decides the same way whether to flatten an @Embedded parent.
 */
const isFieldOperatorObject = (value: Dict): boolean =>
  Object.keys(value).some((key) => key.startsWith("$") && !isLogicalOperator(key));

const guardEncryptedKey = (
  metadata: EntityMetadata,
  key: string,
  method: string,
): void => {
  const field = metadata.fields.find((f) => f.key === key);
  if (!field?.encrypted) return;

  throw new ProteusRepositoryError(
    `Cannot filter on encrypted field "${key}" on entity "${metadata.entity.name}"`,
    {
      code: "unsupported_operation",
      title: "Unsupported Operation",
      details:
        `The field "${key}" is sealed with a random initialisation vector, so the same plaintext ` +
        `encrypts to different ciphertext on every write — no value ${method}() could send would ` +
        `ever match the stored column, and a scheme that made it match would leak equality across ` +
        `rows. To filter on a sealed value, store a deterministic derivative beside it — a digest ` +
        `column written on save — and put the criteria on that column instead.`,
      debug: { entityName: metadata.entity.name, property: key, method },
    },
  );
};

/**
 * Reject criteria that filter on an `@Encrypted` column, at every depth.
 *
 * Without this the query is not merely unsupported, it is silently wrong: the
 * column holds ciphertext, the criteria carries plaintext, and the driver
 * returns zero rows — indistinguishable from a correct empty answer.
 */
export const guardEncryptedCriteria = (
  metadata: EntityMetadata,
  criteria: unknown,
  method: string,
): void => {
  if (!isObject(criteria)) return;

  for (const [key, value] of Object.entries(criteria)) {
    if (isLogicalOperator(key)) {
      // `$and`/`$or` carry an array of conditions and `$not` a single one.
      // Accept either shape from either operator, so a caller writing
      // `$not: [...]` is still walked rather than waved through.
      for (const condition of isArray(value) ? value : [value]) {
        guardEncryptedCriteria(metadata, condition, method);
      }
      continue;
    }

    // A `$`-prefixed key that is not logical is a field-level operator and
    // never names a column.
    if (key.startsWith("$")) continue;

    // `{ address: { city: "x" } }` — an @Embedded parent is flattened to its
    // dotted child keys before any driver sees it, so resolve it the same way
    // or an @Encrypted child slips through under an unencrypted parent key.
    if (isObject(value) && !isFieldOperatorObject(value)) {
      const children = metadata.fields.filter((f) => f.embedded?.parentKey === key);

      if (children.length > 0) {
        for (const childKey of Object.keys(value)) {
          guardEncryptedKey(metadata, `${key}.${childKey}`, method);
        }
        continue;
      }
    }

    guardEncryptedKey(metadata, key, method);
  }
};

/**
 * The declared columns a row really carries a value for.
 *
 * A `@RelationCount` is written as a property WITH a backing `@Field`, and that
 * column is never maintained: every write skips it and every repository read
 * recomputes the value. So the column is in `fields` while its content is a
 * lie, and the two sets below have to start from the columns without it —
 * otherwise a surface that returns stored columns alone would accept the count
 * and hand back whatever the column was defaulted to.
 */
const columnKeys = (metadata: EntityMetadata): Array<string> => {
  const counts = new Set((metadata.relationCounts ?? []).map((rc) => rc.key));
  return metadata.fields.filter((f) => !counts.has(f.key)).map((f) => f.key);
};

/**
 * The keys a COMPILED QUERY projection may name — `QueryBuilder.select()`,
 * `cursor()` and the `stream()` that delegates to it.
 *
 * A query returns the row and nothing else: the declared columns, plus an
 * owning relation's auto-projected foreign key, which hydration assigns unasked
 * and which no `MetaField` of its own accounts for. An owning `*ToOne`
 * `@RelationId` is that foreign key, so it is named here too — the value
 * genuinely comes back. Nothing else virtual does: the remaining `@RelationId`
 * kinds and every `@RelationCount` are loaded AFTER the rows, by the repository,
 * and no query issues that load.
 *
 * A per-relation `select` passes `fields` alone instead: it narrows the columns
 * projected off a joined or separately-queried relation, and that projection
 * carries neither a foreign key (they are stripped again as implicit) nor a
 * relationId (no driver loads a relation's own), so naming either there would
 * resolve to nothing.
 */
export const querySelectableKeys = (metadata: EntityMetadata): Array<string> =>
  uniq([...columnKeys(metadata), ...projectedForeignKeys(metadata)]);

/**
 * The keys a REPOSITORY projection may name — `find`, `findOne`, `versions`,
 * and everything funnelling through them.
 *
 * Everything a query returns, plus the two virtual kinds the repository loads
 * once the rows are in hand and which honour the projection: `@RelationId` and
 * `@RelationCount`. Derived from the query set rather than listed again, so the
 * two can never drift into disagreeing about a column.
 */
export const repositorySelectableKeys = (metadata: EntityMetadata): Array<string> =>
  uniq([
    ...querySelectableKeys(metadata),
    ...(metadata.relationIds ?? []).map((relationId) => relationId.key),
    ...(metadata.relationCounts ?? []).map((relationCount) => relationCount.key),
  ]);

const RELATION_VALUE_DETAILS = {
  "@RelationId":
    "An owning *ToOne relation id rides along on a foreign key the query already " +
    "projects; every other kind costs a query of its own, and only a root read " +
    "through the repository — find(), findOne(), versions() — issues it.",
  "@RelationCount":
    "A relation count is recomputed on every repository read and its backing column " +
    "is never maintained, so a projection that returns stored columns would hand " +
    "back a value that means nothing. Only a root read through the repository — " +
    "find(), findOne(), versions() — computes it.",
} as const;

/**
 * The virtual kind a key names, if any — a `@RelationId` or a `@RelationCount`.
 *
 * Both are populated after the rows are read rather than projected with them, so
 * a surface that cannot populate one owes the caller that reason instead of
 * reporting an unknown field.
 */
const relationValueDecorator = (
  metadata: EntityMetadata,
  key: string,
): keyof typeof RELATION_VALUE_DETAILS | null => {
  if ((metadata.relationIds ?? []).some((ri) => ri.key === key)) return "@RelationId";
  if ((metadata.relationCounts ?? []).some((rc) => rc.key === key)) {
    return "@RelationCount";
  }
  return null;
};

/**
 * Reject a projection key that names nothing.
 *
 * An unknown key matched no field, narrowed nothing and vanished — the caller
 * got an entity missing the column they asked for, with no error, on every
 * driver. `selectable` is the set the surface can actually populate, so what
 * this accepts is exactly what comes back.
 */
export const validateSelectionKeys = (
  metadata: EntityMetadata,
  keys: Array<string>,
  selectable: Array<string>,
): void => {
  const relations = new Set(metadata.relations.map((relation) => relation.key));
  const valid = new Set(selectable);

  for (const key of keys) {
    if (valid.has(key)) continue;

    const decorator = relationValueDecorator(metadata, key);

    if (decorator) {
      throw new ProteusRepositoryError(
        `${decorator} "${key}" cannot be selected on "${metadata.entity.name}" here`,
        {
          code: "relation_value_not_selectable",
          title: "Relation Value Not Selectable",
          details: RELATION_VALUE_DETAILS[decorator],
          debug: { entityName: metadata.entity.name, key, decorator },
        },
      );
    }

    if (relations.has(key)) {
      throw new ProteusRepositoryError(
        `Relation "${key}" cannot be selected on "${metadata.entity.name}"`,
        {
          code: "relation_not_selectable",
          title: "Relation Not Selectable",
          details: `"${key}" is a relation, not a column — load it with include("${key}") or the \`relations\` option, and use that relation's own select to narrow it.`,
          debug: { entityName: metadata.entity.name, key },
        },
      );
    }

    throw new ProteusRepositoryError(
      `Unknown field "${key}" on "${metadata.entity.name}". Available: [${selectable.join(", ")}]`,
      {
        code: "unknown_field",
        title: "Unknown Field",
        details: "The selected key is not declared on this entity.",
        debug: { entityName: metadata.entity.name, key },
      },
    );
  }
};

export const validateRelationNames = (
  metadata: EntityMetadata,
  names: Array<string>,
): void => {
  const validNames = new Set(metadata.relations.map((r) => r.key));
  for (const name of names) {
    if (!validNames.has(name)) {
      throw new ProteusRepositoryError(
        `Unknown relation "${name}" on "${metadata.entity.name}". Available: [${[...validNames].join(", ")}]`,
        {
          code: "unknown_relation",
          title: "Unknown Relation",
          details: "The requested relation is not declared on this entity.",
          debug: { entityName: metadata.entity.name, relation: name },
        },
      );
    }
  }
};
