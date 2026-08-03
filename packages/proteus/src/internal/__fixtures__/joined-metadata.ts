import type { EntityMetadata, MetaField } from "../entity/types/metadata.js";
import { makeField } from "./make-field.js";

/**
 * Joined-inheritance root/child pairs whose PK does NOT survive the write
 * pipeline unchanged — the only shapes that can tell whether the child INSERT
 * compiles its copy of the PK the same way the root does. A plain `uuid` PK
 * cannot: every driver's write coercion passes a string through untouched, so
 * root and child agree by accident.
 *
 * - `bigint`: caught by Postgres / MySQL coercion (bigint → decimal string).
 *   SQLite binds a bigint natively, so it is identity there.
 * - transformed `string`: caught everywhere — `transform.to` runs before any
 *   driver coercion, so a raw child push diverges on every driver.
 */
export class JoinedRoot {}
export class JoinedChild extends JoinedRoot {}
export class TransformedJoinedRoot {}
export class TransformedJoinedChild extends TransformedJoinedRoot {}

const inheritance = (root: Function, discriminatorValue: string | null) => ({
  strategy: "joined",
  discriminatorField: "kind",
  discriminatorValue,
  root,
  parent: discriminatorValue == null ? null : root,
  children: new Map(),
});

const makeMetadata = (
  target: Function,
  root: Function,
  name: string,
  discriminatorValue: string | null,
  fields: Array<MetaField>,
): EntityMetadata =>
  ({
    target,
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name,
      namespace: "app",
      named: false,
    },
    fields,
    embeddedLists: [],
    relations: [],
    relationIds: [],
    relationCounts: [],
    primaryKeys: ["id"],
    generated: [],
    inheritance: inheritance(root, discriminatorValue),
  }) as unknown as EntityMetadata;

// ─── bigint PK ───────────────────────────────────────────────────────────────

const bigIntFields = (): Array<MetaField> => [
  makeField("id", { type: "bigint" }),
  makeField("kind", { type: "string" }),
  makeField("name", { type: "string" }),
];

export const joinedRootMetadata = makeMetadata(
  JoinedRoot,
  JoinedRoot,
  "vehicles",
  null,
  bigIntFields(),
);

export const joinedChildMetadata = makeMetadata(JoinedChild, JoinedRoot, "cars", "car", [
  ...bigIntFields(),
  makeField("doors", { type: "integer" }),
]);

export const joinedChildEntity = {
  id: 9007199254740993n,
  kind: "car",
  name: "Volvo",
  doors: 5,
};

// ─── transformed string PK ───────────────────────────────────────────────────

const transformedFields = (): Array<MetaField> => [
  makeField("id", {
    type: "string",
    transform: {
      to: (value: unknown) => `pk_${value as string}`,
      from: (raw: unknown) => (raw as string).slice(3),
    },
  }),
  makeField("kind", { type: "string" }),
  makeField("name", { type: "string" }),
];

export const transformedJoinedRootMetadata = makeMetadata(
  TransformedJoinedRoot,
  TransformedJoinedRoot,
  "shapes",
  null,
  transformedFields(),
);

export const transformedJoinedChildMetadata = makeMetadata(
  TransformedJoinedChild,
  TransformedJoinedRoot,
  "squares",
  "square",
  [...transformedFields(), makeField("sides", { type: "integer" })],
);

export const transformedJoinedChildEntity = {
  id: "abc",
  kind: "square",
  name: "Square",
  sides: 4,
};
