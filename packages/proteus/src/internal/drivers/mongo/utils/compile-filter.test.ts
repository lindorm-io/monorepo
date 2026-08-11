import type { EntityMetadata, MetaField } from "../../../entity/types/metadata.js";
import { compileFilter } from "./compile-filter.js";
import { describe, expect, test } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeField = (key: string, overrides: Partial<MetaField> = {}): MetaField =>
  ({
    key,
    name: overrides.name ?? key,
    type: overrides.type ?? "string",
    ...overrides,
  }) as unknown as MetaField;

const makeMetadata = (
  fields: Array<MetaField>,
  primaryKeys: Array<string> = ["id"],
): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    fields,
    primaryKeys,
    relations: [],
    inheritance: null,
  }) as unknown as EntityMetadata;

const defaultMetadata = makeMetadata([
  makeField("id"),
  makeField("name"),
  makeField("age", { type: "integer" }),
  makeField("email", { name: "email_address" }),
  makeField("price", { type: "decimal" }),
  makeField("tags", { type: "array" }),
  makeField("data", { type: "object" }),
  makeField("createdAt", { type: "timestamp" }),
]);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("compileFilter", () => {
  describe("simple equality", () => {
    test("should compile direct value equality", () => {
      expect(compileFilter({ name: "foo" }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile null value", () => {
      expect(compileFilter({ name: null }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile numeric equality", () => {
      expect(compileFilter({ age: 25 }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile multiple field equality", () => {
      expect(compileFilter({ name: "foo", age: 25 }, defaultMetadata)).toMatchSnapshot();
    });
  });

  describe("PK field mapping", () => {
    test("should map PK field to _id", () => {
      expect(compileFilter({ id: "abc-123" }, defaultMetadata)).toMatchSnapshot();
    });

    test("should map PK with operator to _id", () => {
      expect(
        compileFilter({ id: { $eq: "abc-123" } }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });

  describe("field name mapping", () => {
    test("should use metadata name for mapped fields", () => {
      expect(
        compileFilter({ email: "test@example.com" }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });

  describe("comparison operators", () => {
    test("should compile $eq", () => {
      expect(compileFilter({ name: { $eq: "foo" } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile $ne", () => {
      expect(compileFilter({ name: { $ne: "foo" } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile $gt", () => {
      expect(compileFilter({ age: { $gt: 18 } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile $gte", () => {
      expect(compileFilter({ age: { $gte: 18 } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile $lt", () => {
      expect(compileFilter({ age: { $lt: 65 } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile $lte", () => {
      expect(compileFilter({ age: { $lte: 65 } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile $in", () => {
      expect(
        compileFilter({ name: { $in: ["foo", "bar"] } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $nin", () => {
      expect(
        compileFilter({ name: { $nin: ["foo", "bar"] } }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });

  describe("$like and $ilike", () => {
    test("should convert $like with leading wildcard to $regex", () => {
      expect(
        compileFilter({ name: { $like: "%foo" } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should convert $like with trailing wildcard to $regex", () => {
      expect(
        compileFilter({ name: { $like: "foo%" } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should convert $like with both wildcards to $regex", () => {
      expect(
        compileFilter({ name: { $like: "%foo%" } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should convert $ilike to case-insensitive $regex", () => {
      expect(
        compileFilter({ name: { $ilike: "%foo%" } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should convert $like with underscore wildcard", () => {
      expect(
        compileFilter({ name: { $like: "fo_" } }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });

  describe("$between", () => {
    test("should compile $between to $gte + $lte", () => {
      expect(
        compileFilter({ age: { $between: [18, 65] } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $between on decimal field with $expr", () => {
      expect(
        compileFilter({ price: { $between: [10.5, 99.9] } }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });

  describe("$isNull", () => {
    test("should compile $isNull true to $eq null", () => {
      expect(
        compileFilter({ name: { $isNull: true } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $isNull false to $ne null", () => {
      expect(
        compileFilter({ name: { $isNull: false } }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });

  describe("$regex", () => {
    test("should compile $regex from string", () => {
      expect(
        compileFilter({ name: { $regex: "^foo" } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $regex from RegExp instance", () => {
      expect(
        compileFilter({ name: { $regex: /^foo/i } }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });

  describe("logical operators", () => {
    test("should compile $and", () => {
      expect(
        compileFilter(
          { $and: [{ name: "foo" }, { age: { $gt: 18 } }] } as any,
          defaultMetadata,
        ),
      ).toMatchSnapshot();
    });

    test("should compile $or", () => {
      expect(
        compileFilter({ $or: [{ name: "foo" }, { name: "bar" }] }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile nested $and and $or", () => {
      expect(
        compileFilter(
          {
            $and: [{ $or: [{ name: "foo" }, { name: "bar" }] }, { age: { $gte: 18 } }],
          } as any,
          defaultMetadata,
        ),
      ).toMatchSnapshot();
    });

    // MongoDB has no top-level $not — the server rejects it with "unknown top
    // level operator: $not". A criteria-level $not compiles to $nor over the
    // negated sub-predicate.
    test("should compile a criteria-level $not to $nor", () => {
      expect(compileFilter({ $not: { name: "foo" } } as any, defaultMetadata)).toEqual({
        $nor: [{ name: "foo" }],
      });
    });

    test("should compile a criteria-level $not over a nested $or", () => {
      expect(
        compileFilter(
          { $not: { $or: [{ name: "foo" }, { name: "bar" }] } } as any,
          defaultMetadata,
        ),
      ).toMatchSnapshot();
    });

    test("should compile a criteria-level $not alongside a sibling field", () => {
      expect(
        compileFilter(
          { age: { $gte: 18 }, $not: { name: "foo" } } as any,
          defaultMetadata,
        ),
      ).toMatchSnapshot();
    });

    // The FIELD-level `{ field: { $not: … } }` form is a different operator. It
    // negates through $nor as well: Mongo's own field-level $not takes only a
    // document or a regex, so a compiled plain equality or $and/$expr fan-out
    // cannot pass through it, and $nor negates every shape alike.
    test("should compile a field-level $not to $nor", () => {
      expect(
        compileFilter({ name: { $not: { $eq: "foo" } } } as any, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile a field-level $not over a bare value", () => {
      expect(
        compileFilter({ name: { $not: "foo" } } as any, defaultMetadata),
      ).toMatchSnapshot();
    });

    // An inner condition that constrains nothing matches every document, so its
    // negation matches none. Mongo rejects an empty `$not` outright, so this
    // needs a constant rather than a negated clause.
    test("should compile an empty field-level $not to a match-nothing constant", () => {
      expect(
        compileFilter({ name: { $not: {} } } as any, defaultMetadata),
      ).toMatchSnapshot();
    });

    // One `$nor` key cannot carry two independent negations — they must fan out
    // into `$and` instead of overwriting each other.
    test("should keep two field-level $not clauses apart", () => {
      expect(
        compileFilter(
          { name: { $not: { $eq: "foo" } }, age: { $not: { $gte: 18 } } } as any,
          defaultMetadata,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("complex predicates", () => {
    test("should compile $has with object value", () => {
      expect(
        compileFilter({ data: { $has: { key: "value" } } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $has with non-object value (array element check)", () => {
      expect(compileFilter({ tags: { $has: "foo" } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should compile $all", () => {
      expect(
        compileFilter({ tags: { $all: ["a", "b"] } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $overlap", () => {
      expect(
        compileFilter({ tags: { $overlap: ["a", "b"] } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $contained", () => {
      expect(
        compileFilter({ tags: { $contained: ["a", "b", "c"] } }, defaultMetadata),
      ).toMatchSnapshot();
    });

    test("should compile $length", () => {
      expect(compileFilter({ tags: { $length: 3 } }, defaultMetadata)).toMatchSnapshot();
    });
  });

  describe("decimal field comparisons", () => {
    test("should use $expr + $toDouble for $gt on decimal field", () => {
      expect(compileFilter({ price: { $gt: 10.5 } }, defaultMetadata)).toMatchSnapshot();
    });

    test("should use $expr + $toDouble for $lte on decimal field", () => {
      expect(compileFilter({ price: { $lte: 99.9 } }, defaultMetadata)).toMatchSnapshot();
    });
  });

  describe("empty and edge cases", () => {
    test("should return empty filter for empty criteria", () => {
      expect(compileFilter({}, defaultMetadata)).toMatchSnapshot();
    });

    // `undefined` means "not supplied", so the key is not there at all. Reading
    // it as `null` compiled a criterion nobody wrote, and every other driver
    // reads it the same way — this was the outlier.
    test("should ignore a key whose value is undefined", () => {
      expect(compileFilter({ name: undefined }, defaultMetadata)).toEqual({});
    });

    test("should refuse a named field with an empty operator bag", () => {
      expect(() => compileFilter({ name: {} } as any, defaultMetadata)).toThrow(
        /requires at least one operator/,
      );
    });

    test.each([["$and"], ["$or"]])("should refuse an empty %s", (operator) => {
      expect(() => compileFilter({ [operator]: [] } as any, defaultMetadata)).toThrow(
        /requires at least one member/,
      );
    });
  });

  describe("$has with multiple keys", () => {
    test("should compile $has with multiple key-value pairs as $and", () => {
      expect(
        compileFilter({ data: { $has: { a: 1, b: 2 } } }, defaultMetadata),
      ).toMatchSnapshot();
    });
  });
});
