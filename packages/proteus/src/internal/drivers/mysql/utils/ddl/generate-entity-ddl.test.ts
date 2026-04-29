import { describe, expect, test } from "vitest";
import {
  TestArticle,
  TestAuthor,
  TestChecked,
  TestCourse,
  TestIndexed,
  TestProfile,
  TestScopedEntity,
  TestSoftDelete,
  TestUser,
  TestUserWithProfile,
  TestVersionKeyed,
} from "../../../../__fixtures__/test-entities.js";
import { generateEntityDDL } from "./generate-entity-ddl.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";

const OPTS = {};

describe("generateEntityDDL (MySQL)", () => {
  describe("MysqlDdlOutput structure", () => {
    test("returns an object with tables and indexes keys", () => {
      const meta = getEntityMetadata(TestUser);
      const result = generateEntityDDL(meta, OPTS);
      expect(Object.keys(result).sort()).toEqual(["indexes", "tables", "triggers"]);
    });

    test("all output values are arrays", () => {
      const meta = getEntityMetadata(TestUser);
      const result = generateEntityDDL(meta, OPTS);
      for (const value of Object.values(result)) {
        expect(Array.isArray(value)).toBe(true);
      }
    });
  });

  describe("simple entities", () => {
    test("generates full DDL for TestUser", () => {
      const meta = getEntityMetadata(TestUser);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestScopedEntity", () => {
      const meta = getEntityMetadata(TestScopedEntity);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestSoftDelete", () => {
      const meta = getEntityMetadata(TestSoftDelete);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestVersionKeyed (composite PK)", () => {
      const meta = getEntityMetadata(TestVersionKeyed);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });
  });

  describe("indexes", () => {
    test("emits indexes for TestIndexed", () => {
      const meta = getEntityMetadata(TestIndexed);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.indexes.length).toBeGreaterThan(0);
      expect(result).toMatchSnapshot();
    });
  });

  describe("many-to-many join tables", () => {
    test("emits join table DDL for TestCourse (owning side)", () => {
      const meta = getEntityMetadata(TestCourse);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.tables.length).toBeGreaterThan(1);
      expect(result).toMatchSnapshot();
    });

    test("generates only main table for non-M2M entity", () => {
      const meta = getEntityMetadata(TestSoftDelete);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.tables).toHaveLength(1);
    });
  });

  describe("check constraints", () => {
    test("check constraints appear inside CREATE TABLE body for TestChecked", () => {
      const meta = getEntityMetadata(TestChecked);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.tables[0]).toContain("CONSTRAINT");
      expect(result.tables[0]).toContain("CHECK");
      expect(result).toMatchSnapshot();
    });
  });

  describe("unique constraints", () => {
    test("unique constraints appear inside CREATE TABLE body for TestIndexed", () => {
      const meta = getEntityMetadata(TestIndexed);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.tables[0]).toContain("UNIQUE KEY");
    });
  });

  describe("relation entities (full DDL)", () => {
    test("generates full DDL for TestArticle (ManyToOne, owning)", () => {
      const meta = getEntityMetadata(TestArticle);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestAuthor (OneToMany, inverse)", () => {
      const meta = getEntityMetadata(TestAuthor);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestProfile (inverse OneToOne)", () => {
      const meta = getEntityMetadata(TestProfile);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestUserWithProfile (owning OneToOne)", () => {
      const meta = getEntityMetadata(TestUserWithProfile);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });
  });

  describe("table options", () => {
    test("all tables include ENGINE=InnoDB and utf8mb4 charset", () => {
      const meta = getEntityMetadata(TestCourse);
      const result = generateEntityDDL(meta, OPTS);
      for (const table of result.tables) {
        expect(table).toContain(
          "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
        );
      }
    });
  });
});
