import { describe, expect, test } from "vitest";
import {
  TestArticle,
  TestChecked,
  TestIndexed,
  TestScopedEntity,
  TestSoftDelete,
  TestUser,
  TestUserWithProfile,
  TestVersionKeyed,
} from "../../../../__fixtures__/test-entities.js";
import { generateTableDDL } from "./generate-table-ddl.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";

describe("generateTableDDL (MySQL)", () => {
  test("generates CREATE TABLE for a simple entity with UUID PK", () => {
    const meta = getEntityMetadata(TestUser);
    expect(generateTableDDL(meta, "TestUser")).toMatchSnapshot();
  });

  test("generates CREATE TABLE for entity with UUID PK and ManyToOne FK column", () => {
    const meta = getEntityMetadata(TestArticle);
    expect(generateTableDDL(meta, "TestArticle")).toMatchSnapshot();
  });

  test("generates CREATE TABLE with scope field", () => {
    const meta = getEntityMetadata(TestScopedEntity);
    expect(generateTableDDL(meta, "TestScopedEntity")).toMatchSnapshot();
  });

  test("generates CREATE TABLE with soft-delete and expiry date fields", () => {
    const meta = getEntityMetadata(TestSoftDelete);
    expect(generateTableDDL(meta, "TestSoftDelete")).toMatchSnapshot();
  });

  test("generates CREATE TABLE with check constraints", () => {
    const meta = getEntityMetadata(TestChecked);
    expect(generateTableDDL(meta, "TestChecked")).toMatchSnapshot();
  });

  test("generates CREATE TABLE with unique constraints", () => {
    const meta = getEntityMetadata(TestIndexed);
    expect(generateTableDDL(meta, "TestIndexed")).toMatchSnapshot();
  });

  test("generates CREATE TABLE for owning side of OneToOne (includes FK column)", () => {
    const meta = getEntityMetadata(TestUserWithProfile);
    expect(generateTableDDL(meta, "TestUserWithProfile")).toMatchSnapshot();
  });

  test("generates CREATE TABLE with composite primary key", () => {
    const meta = getEntityMetadata(TestVersionKeyed);
    expect(generateTableDDL(meta, "TestVersionKeyed")).toMatchSnapshot();
  });

  test("output starts with CREATE TABLE IF NOT EXISTS", () => {
    const meta = getEntityMetadata(TestUser);
    const ddl = generateTableDDL(meta, "TestUser");
    expect(ddl.startsWith("CREATE TABLE IF NOT EXISTS")).toBe(true);
  });

  test("output ends with a semicolon", () => {
    const meta = getEntityMetadata(TestUser);
    const ddl = generateTableDDL(meta, "TestUser");
    expect(ddl.endsWith(";")).toBe(true);
  });

  test("output includes ENGINE=InnoDB table options", () => {
    const meta = getEntityMetadata(TestUser);
    const ddl = generateTableDDL(meta, "TestUser");
    expect(ddl).toContain(
      "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    );
  });

  test("table name uses backtick quoting", () => {
    const meta = getEntityMetadata(TestUser);
    const ddl = generateTableDDL(meta, "TestUser");
    expect(ddl).toContain("`TestUser`");
  });
});
