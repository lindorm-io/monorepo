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
} from "../../../../__fixtures__/test-entities";
import { Entity } from "../../../../../decorators/Entity";
import { Field } from "../../../../../decorators/Field";
import { Max } from "../../../../../decorators/Max";
import { Namespace } from "../../../../../decorators/Namespace";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField";
import { generateEntityDDL } from "./generate-entity-ddl";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";

// ---------------------------------------------------------------------------
// Additional test entities at module scope
// ---------------------------------------------------------------------------

/** Entity with a vector field — should auto-detect and add pgvector extension */
@Entity({ name: "DdlVectorEntity" })
class DdlVectorEntity {
  @PrimaryKeyField()
  id!: string;

  @Max(1536)
  @Field("vector")
  embedding!: number[];
}

/** Entity with a namespace — should emit CREATE SCHEMA */
@Namespace("analytics")
@Entity({ name: "DdlNamespacedEntity" })
class DdlNamespacedEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  label!: string;
}

const OPTS = {};
const OPTS_NS = { namespace: "reports" };

describe("generateEntityDDL", () => {
  describe("DdlOutput structure", () => {
    test("returns an object with all expected DdlOutput keys", () => {
      const meta = getEntityMetadata(TestUser);
      const result = generateEntityDDL(meta, OPTS);
      expect(Object.keys(result).sort()).toEqual(
        [
          "comments",
          "constraints",
          "extensions",
          "indexes",
          "schemas",
          "tables",
          "triggers",
          "types",
        ].sort(),
      );
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

    test("generates full DDL for TestScopedEntity (scope field)", () => {
      const meta = getEntityMetadata(TestScopedEntity);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestSoftDelete (delete/expiry date fields)", () => {
      const meta = getEntityMetadata(TestSoftDelete);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });

    test("generates full DDL for TestVersionKeyed (composite PK)", () => {
      const meta = getEntityMetadata(TestVersionKeyed);
      expect(generateEntityDDL(meta, OPTS)).toMatchSnapshot();
    });
  });

  describe("extensions auto-detection", () => {
    test("adds pgvector extension when entity has a vector field", () => {
      const meta = getEntityMetadata(DdlVectorEntity);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.extensions).toContain("CREATE EXTENSION IF NOT EXISTS vector;");
      expect(result).toMatchSnapshot();
    });

    test("no extensions emitted for standard entity without vector field", () => {
      const meta = getEntityMetadata(DdlVectorEntity);
      // Use a non-vector entity for "no extensions"
      const plainMeta = getEntityMetadata(TestSoftDelete);
      const result = generateEntityDDL(plainMeta, OPTS);
      expect(result.extensions).toEqual([]);
    });
  });

  describe("schema creation", () => {
    test("no schema statement emitted when no namespace", () => {
      const meta = getEntityMetadata(TestUser);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.schemas).toEqual([]);
    });

    test("emits CREATE SCHEMA when entity has a namespace decorator", () => {
      const meta = getEntityMetadata(DdlNamespacedEntity);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.schemas).toContain('CREATE SCHEMA IF NOT EXISTS "analytics";');
      expect(result).toMatchSnapshot();
    });

    test("emits CREATE SCHEMA when namespace is in options", () => {
      const meta = getEntityMetadata(TestUser);
      const result = generateEntityDDL(meta, OPTS_NS);
      expect(result.schemas).toContain('CREATE SCHEMA IF NOT EXISTS "reports";');
      expect(result).toMatchSnapshot();
    });
  });

  describe("constraints (FK)", () => {
    test("no FK constraints for an entity with no owning relations", () => {
      const meta = getEntityMetadata(TestUser);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.constraints).toEqual([]);
    });

    test("emits FK constraint for TestArticle (ManyToOne author)", () => {
      const meta = getEntityMetadata(TestArticle);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.constraints.length).toBeGreaterThan(0);
      expect(result.constraints[0]).toMatch(/ALTER TABLE.*ADD CONSTRAINT.*FOREIGN KEY/);
    });

    test("emits FK constraint for TestUserWithProfile (owning side OneToOne)", () => {
      const meta = getEntityMetadata(TestUserWithProfile);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.constraints.length).toBeGreaterThan(0);
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
      // tables = main table + join table
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
    test("check constraints appear inside the CREATE TABLE body for TestChecked", () => {
      const meta = getEntityMetadata(TestChecked);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.tables[0]).toContain("CONSTRAINT");
      expect(result.tables[0]).toContain("CHECK");
      expect(result).toMatchSnapshot();
    });
  });

  describe("unique constraints", () => {
    test("unique constraints appear inside the CREATE TABLE body for TestIndexed", () => {
      const meta = getEntityMetadata(TestIndexed);
      const result = generateEntityDDL(meta, OPTS);
      expect(result.tables[0]).toContain("UNIQUE");
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
});
