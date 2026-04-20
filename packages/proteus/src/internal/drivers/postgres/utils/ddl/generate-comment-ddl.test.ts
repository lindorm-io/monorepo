import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaField } from "../../../../entity/types/metadata";
import { generateCommentDDL } from "./generate-comment-ddl";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Helper to build minimal EntityMetadata for testing
// ---------------------------------------------------------------------------

const makeMetadata = (tableComment: string | null, fields: MetaField[]): EntityMetadata =>
  ({
    target: class {},
    appendOnly: false,
    cache: null,
    checks: [],
    defaultOrder: null,
    embeddedLists: [],
    entity: {
      decorator: "Entity",
      cache: null,
      comment: tableComment,
      database: null,
      name: "TestCommentEntity",
      namespace: null,
    },
    extras: [],
    fields,
    filters: [],
    generated: [],
    hooks: [],
    inheritance: null,
    indexes: [],
    primaryKeys: ["id"],
    relations: [],
    relationCounts: [],
    relationIds: [],
    schemas: [],
    scopeKeys: [],
    uniques: [],
    versionKeys: [],
  }) as EntityMetadata;

const TABLE = "test_comment_entity";
const NS = null;
const NS_SCOPED = "reporting";

describe("generateCommentDDL", () => {
  test("returns empty array when entity has no table comment and no field comments", () => {
    const meta = makeMetadata(null, [makeField("id"), makeField("name")]);
    expect(generateCommentDDL(meta, TABLE, NS)).toEqual([]);
  });

  test("generates COMMENT ON TABLE when entity comment is set", () => {
    const meta = makeMetadata("Stores user accounts", [makeField("id")]);
    expect(generateCommentDDL(meta, TABLE, NS)).toMatchSnapshot();
  });

  test("generates COMMENT ON COLUMN for fields with comments", () => {
    const meta = makeMetadata(null, [
      makeField("id"),
      makeField("name", { comment: "The display name" }),
      makeField("email", { comment: "Primary contact email" }),
    ]);
    expect(generateCommentDDL(meta, TABLE, NS)).toMatchSnapshot();
  });

  test("generates both TABLE and COLUMN comments when both are present", () => {
    const meta = makeMetadata("A combined entity", [
      makeField("id"),
      makeField("label", { comment: "The user label" }),
    ]);
    expect(generateCommentDDL(meta, TABLE, NS)).toMatchSnapshot();
  });

  test("escapes single quotes in table comment", () => {
    const meta = makeMetadata("It's a table", [makeField("id")]);
    const result = generateCommentDDL(meta, TABLE, NS);
    expect(result[0]).toContain("It''s a table");
    expect(result).toMatchSnapshot();
  });

  test("escapes single quotes in field comment", () => {
    const meta = makeMetadata(null, [
      makeField("id"),
      makeField("owner", { comment: "Owner's name" }),
    ]);
    const result = generateCommentDDL(meta, TABLE, NS);
    expect(result[0]).toContain("Owner''s name");
    expect(result).toMatchSnapshot();
  });

  test("uses schema-qualified table name when namespace is provided", () => {
    const meta = makeMetadata("A scoped table", [makeField("id")]);
    const result = generateCommentDDL(meta, TABLE, NS_SCOPED);
    expect(result[0]).toContain('"reporting"."test_comment_entity"');
    expect(result).toMatchSnapshot();
  });

  test("COLUMN comment uses qualified table name when namespace is provided", () => {
    const meta = makeMetadata(null, [
      makeField("id"),
      makeField("name", { comment: "The name column" }),
    ]);
    const result = generateCommentDDL(meta, TABLE, NS_SCOPED);
    expect(result[0]).toContain('"reporting"."test_comment_entity"."name"');
    expect(result).toMatchSnapshot();
  });

  test("skips fields that have no comment", () => {
    const meta = makeMetadata(null, [
      makeField("id"),
      makeField("name", { comment: "Has a comment" }),
      makeField("age"), // no comment
    ]);
    const result = generateCommentDDL(meta, TABLE, NS);
    expect(result).toHaveLength(1);
    expect(result).toMatchSnapshot();
  });

  test("each statement ends with a semicolon", () => {
    const meta = makeMetadata("Table comment", [
      makeField("id"),
      makeField("n", { comment: "Col comment" }),
    ]);
    const result = generateCommentDDL(meta, TABLE, NS);
    expect(result.every((s) => s.endsWith(";"))).toBe(true);
  });
});
