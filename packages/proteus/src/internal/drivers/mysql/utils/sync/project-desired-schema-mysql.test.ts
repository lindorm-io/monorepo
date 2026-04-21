import { describe, expect, test } from "vitest";
import {
  TestUser,
  TestArticle,
  TestScopedEntity,
  TestChecked,
  TestIndexed,
  TestUserWithProfile,
  TestCourse,
  TestStudent,
} from "../../../../__fixtures__/test-entities.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { projectDesiredSchemaMysql } from "./project-desired-schema-mysql.js";

describe("projectDesiredSchemaMysql", () => {
  test("projects a simple entity with UUID PK", () => {
    const meta = getEntityMetadata(TestUser);
    const schema = projectDesiredSchemaMysql([meta], {});

    expect(schema).toMatchSnapshot();
  });

  test("projects an entity with a ManyToOne FK", () => {
    const userMeta = getEntityMetadata(TestUser);
    const articleMeta = getEntityMetadata(TestArticle);
    const schema = projectDesiredSchemaMysql([userMeta, articleMeta], {});

    expect(schema).toMatchSnapshot();
  });

  test("projects with namespace", () => {
    const meta = getEntityMetadata(TestScopedEntity);
    const schema = projectDesiredSchemaMysql([meta], { namespace: "myapp" });

    expect(schema).toMatchSnapshot();
  });

  test("projects entity with check constraints", () => {
    const meta = getEntityMetadata(TestChecked);
    const schema = projectDesiredSchemaMysql([meta], {});

    expect(schema).toMatchSnapshot();
  });

  test("projects entity with indexes and unique constraints", () => {
    const meta = getEntityMetadata(TestIndexed);
    const schema = projectDesiredSchemaMysql([meta], {});

    expect(schema).toMatchSnapshot();
  });

  test("projects ManyToMany join table", () => {
    const courseMeta = getEntityMetadata(TestCourse);
    const studentMeta = getEntityMetadata(TestStudent);
    const schema = projectDesiredSchemaMysql([courseMeta, studentMeta], {});

    // Should include the join table alongside the entity tables
    const joinTable = schema.tables.find(
      (t) => t.name !== "TestCourse" && t.name !== "TestStudent",
    );
    expect(joinTable).toBeDefined();
    expect(joinTable!.foreignKeys.length).toBeGreaterThanOrEqual(2);
    expect(schema).toMatchSnapshot();
  });

  test("projects owning side of OneToOne with FK column", () => {
    const meta = getEntityMetadata(TestUserWithProfile);
    const schema = projectDesiredSchemaMysql([meta], {});

    expect(schema).toMatchSnapshot();
  });
});
