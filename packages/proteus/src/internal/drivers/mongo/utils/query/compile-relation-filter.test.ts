import { describe, expect, test } from "vitest";
import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import { compileRelationFilter } from "./compile-relation-filter.js";

const makeInclude = (overrides: Partial<IncludeSpec> = {}): IncludeSpec => ({
  relation: "posts",
  required: false,
  strategy: "join",
  select: null,
  where: null,
  ...overrides,
});

const plain: EntityMetadata = {
  entity: { name: "Post" },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title"),
    makeField("authorId", { type: "uuid", name: "author_id", nullable: true }),
  ],
  relations: [],
  primaryKeys: ["id"],
  filters: [],
  inheritance: null,
} as unknown as EntityMetadata;

const ctx = { withDeleted: false, versionTimestamp: null };

describe("compileRelationFilter", () => {
  test("nothing constrains a plain relation", () => {
    expect(compileRelationFilter(makeInclude(), plain, ctx)).toBeNull();
  });

  test("a relation where addresses the foreign column, not the property key", () => {
    expect(
      compileRelationFilter(makeInclude({ where: { authorId: "a1" } }), plain, ctx),
    ).toEqual({ author_id: "a1" });
  });

  test("the foreign primary key addresses _id", () => {
    expect(
      compileRelationFilter(makeInclude({ where: { id: "p1" } }), plain, ctx),
    ).toEqual({ _id: "p1" });
  });

  // The foreign entity's own soft-delete applies to the relation, so a deleted
  // row is as absent from a relation as it is from a root query.
  describe("soft delete", () => {
    const softDeletable: EntityMetadata = {
      ...plain,
      fields: [
        ...plain.fields,
        makeField("deletedAt", {
          decorator: "DeleteDate",
          type: "date",
          name: "deleted_at",
          nullable: true,
        }),
      ],
    } as unknown as EntityMetadata;

    test("excludes soft-deleted foreign rows", () => {
      expect(compileRelationFilter(makeInclude(), softDeletable, ctx)).toMatchSnapshot();
    });

    test("withDeleted lets them back in", () => {
      expect(
        compileRelationFilter(makeInclude(), softDeletable, {
          ...ctx,
          withDeleted: true,
        }),
      ).toBeNull();
    });
  });

  // A versioned foreign entity only ever contributes the row that is live at the
  // time being read — the open-ended one by default.
  describe("temporal versions", () => {
    const versioned: EntityMetadata = {
      ...plain,
      fields: [
        ...plain.fields,
        makeField("validFrom", {
          decorator: "VersionStartDate",
          type: "date",
          name: "valid_from",
        }),
        makeField("validTo", {
          decorator: "VersionEndDate",
          type: "date",
          name: "valid_to",
          nullable: true,
        }),
      ],
    } as unknown as EntityMetadata;

    test("takes the open-ended row when no timestamp is asked for", () => {
      expect(compileRelationFilter(makeInclude(), versioned, ctx)).toEqual({
        valid_to: null,
      });
    });

    test("takes the row live at the asked-for timestamp", () => {
      const at = new Date("2020-01-01T00:00:00.000Z");

      expect(
        compileRelationFilter(makeInclude(), versioned, {
          ...ctx,
          versionTimestamp: at,
        }),
      ).toEqual({
        valid_from: { $lte: at },
        $or: [{ valid_to: null }, { valid_to: { $gt: at } }],
      });
    });

    test("composes the version window with the relation's own where", () => {
      expect(
        compileRelationFilter(makeInclude({ where: { title: "T" } }), versioned, ctx),
      ).toEqual({ $and: [{ title: "T" }, { valid_to: null }] });
    });
  });

  // A polymorphic relation target is one class in a shared collection, so the
  // discriminator is what separates it from its siblings.
  test("a single-table child is scoped by its discriminator", () => {
    const child: EntityMetadata = {
      ...plain,
      entity: { name: "Car" },
      fields: [...plain.fields, makeField("type")],
      inheritance: {
        strategy: "single-table",
        discriminatorField: "type",
        discriminatorValue: "car",
        root: class Vehicle {},
      },
    } as unknown as EntityMetadata;

    expect(compileRelationFilter(makeInclude(), child, ctx)).toEqual({ type: "car" });
  });
});
