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

const NS = null;
const NS_SCOPED = "public";
const OPTS = {};
const OPTS_SCOPED = { namespace: "public" };

describe("generateTableDDL", () => {
  test("generates CREATE TABLE for a simple entity with UUID PK", () => {
    const meta = getEntityMetadata(TestUser);
    expect(generateTableDDL(meta, "TestUser", NS, OPTS)).toMatchSnapshot();
  });

  test("generates CREATE TABLE with schema namespace", () => {
    const meta = getEntityMetadata(TestUser);
    expect(generateTableDDL(meta, "TestUser", NS_SCOPED, OPTS_SCOPED)).toMatchSnapshot();
  });

  test("generates CREATE TABLE for entity with UUID PK and ManyToOne FK column", () => {
    const meta = getEntityMetadata(TestArticle);
    expect(generateTableDDL(meta, "TestArticle", NS, OPTS)).toMatchSnapshot();
  });

  test("generates CREATE TABLE with scope field", () => {
    const meta = getEntityMetadata(TestScopedEntity);
    expect(generateTableDDL(meta, "TestScopedEntity", NS, OPTS)).toMatchSnapshot();
  });

  test("generates CREATE TABLE with soft-delete and expiry date fields", () => {
    const meta = getEntityMetadata(TestSoftDelete);
    expect(generateTableDDL(meta, "TestSoftDelete", NS, OPTS)).toMatchSnapshot();
  });

  test("generates CREATE TABLE with check constraints", () => {
    const meta = getEntityMetadata(TestChecked);
    expect(generateTableDDL(meta, "TestChecked", NS, OPTS)).toMatchSnapshot();
  });

  test("generates CREATE TABLE with unique constraints", () => {
    const meta = getEntityMetadata(TestIndexed);
    expect(generateTableDDL(meta, "TestIndexed", NS, OPTS)).toMatchSnapshot();
  });

  test("generates CREATE TABLE for owning side of OneToOne (includes FK column)", () => {
    const meta = getEntityMetadata(TestUserWithProfile);
    expect(generateTableDDL(meta, "TestUserWithProfile", NS, OPTS)).toMatchSnapshot();
  });

  test("generates CREATE TABLE with composite primary key (VersionKeyed)", () => {
    const meta = getEntityMetadata(TestVersionKeyed);
    expect(generateTableDDL(meta, "TestVersionKeyed", NS, OPTS)).toMatchSnapshot();
  });

  test("output starts with CREATE TABLE IF NOT EXISTS", () => {
    const meta = getEntityMetadata(TestUser);
    const ddl = generateTableDDL(meta, "TestUser", NS, OPTS);
    expect(ddl.startsWith("CREATE TABLE IF NOT EXISTS")).toBe(true);
  });

  test("output ends with a semicolon", () => {
    const meta = getEntityMetadata(TestUser);
    const ddl = generateTableDDL(meta, "TestUser", NS, OPTS);
    expect(ddl.endsWith(";")).toBe(true);
  });

  test("qualified table name appears in output when namespace is provided", () => {
    const meta = getEntityMetadata(TestUser);
    const ddl = generateTableDDL(meta, "TestUser", NS_SCOPED, OPTS_SCOPED);
    expect(ddl).toContain('"public"."TestUser"');
  });
});
