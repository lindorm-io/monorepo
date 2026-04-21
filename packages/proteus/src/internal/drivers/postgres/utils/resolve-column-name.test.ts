import { makeField } from "../../../__fixtures__/make-field.js";
import type { MetaRelation } from "../../../entity/types/metadata.js";
import { ProteusError } from "../../../../errors/index.js";
import { resolveColumnName, resolveColumnNameSafe } from "./resolve-column-name.js";
import { describe, expect, test } from "vitest";

const fields = [
  makeField("id", { type: "uuid", name: "id" }),
  makeField("firstName", { type: "string", name: "first_name" }),
  makeField("email", { type: "string", name: "email_address" }),
  makeField("age", { type: "integer", name: "age" }),
];

const makeRelation = (joinKeys: Record<string, string> | null): MetaRelation =>
  ({
    key: "profile",
    foreignConstructor: () => class {},
    foreignKey: "user",
    findKeys: null,
    joinKeys,
    joinTable: null,
    options: {} as any,
    orderBy: null,
    type: "OneToOne",
  }) as unknown as MetaRelation;

describe("resolveColumnName", () => {
  describe("field found in metadata", () => {
    test("returns the column name for a field with a matching key", () => {
      expect(resolveColumnName(fields, "id")).toMatchSnapshot();
    });

    test("returns mapped column name when key differs from column name", () => {
      expect(resolveColumnName(fields, "firstName")).toMatchSnapshot();
    });

    test("returns mapped column name for email field", () => {
      expect(resolveColumnName(fields, "email")).toMatchSnapshot();
    });
  });

  describe("field not found — no relations provided", () => {
    test("throws ProteusError when key does not exist and no relations given", () => {
      expect(() => resolveColumnName(fields, "nonexistent")).toThrow(ProteusError);
    });

    test("error message includes the missing key name", () => {
      expect(() => resolveColumnName(fields, "missingField")).toThrow(
        /Field "missingField" not found in metadata/,
      );
    });

    test("error message lists valid field keys", () => {
      expect(() => resolveColumnName(fields, "ghost")).toThrow(
        /Valid fields: id, firstName, email, age/,
      );
    });
  });

  describe("field not found — relations provided", () => {
    test("returns the key itself when it matches a joinKey in a relation", () => {
      const relations = [makeRelation({ profileId: "id" })];
      expect(resolveColumnName(fields, "profileId", relations)).toMatchSnapshot();
    });

    test("throws ProteusError when key is not in fields or any relation joinKeys", () => {
      const relations = [makeRelation({ profileId: "id" })];
      expect(() => resolveColumnName(fields, "unknownKey", relations)).toThrow(
        ProteusError,
      );
    });

    test("skips relations without joinKeys (null joinKeys)", () => {
      const relations = [makeRelation(null)];
      expect(() => resolveColumnName(fields, "profileId", relations)).toThrow(
        ProteusError,
      );
    });

    test("checks joinKeys across multiple relations", () => {
      const relations = [makeRelation(null), makeRelation({ categoryId: "id" })];
      expect(resolveColumnName(fields, "categoryId", relations)).toMatchSnapshot();
    });
  });

  describe("prototype pollution resistance", () => {
    test("does not match inherited Object.prototype properties as joinKeys", () => {
      const relations = [makeRelation({ profileId: "id" })];
      expect(() => resolveColumnName(fields, "constructor", relations)).toThrow(
        ProteusError,
      );
      expect(() => resolveColumnName(fields, "toString", relations)).toThrow(
        ProteusError,
      );
      expect(() => resolveColumnName(fields, "__proto__", relations)).toThrow(
        ProteusError,
      );
    });
  });

  describe("empty fields array", () => {
    test("throws with (none) in error message when fields array is empty", () => {
      expect(() => resolveColumnName([], "anyKey")).toThrow(/Valid fields: \(none\)/);
    });

    test("returns key from joinKeys even with empty fields array", () => {
      const relations = [makeRelation({ tenantId: "id" })];
      expect(resolveColumnName([], "tenantId", relations)).toMatchSnapshot();
    });
  });
});

describe("resolveColumnNameSafe", () => {
  test("returns the column name for a known field key", () => {
    expect(resolveColumnNameSafe(fields, "firstName")).toMatchSnapshot();
  });

  test("returns the key itself when no matching field is found", () => {
    expect(resolveColumnNameSafe(fields, "unknownColumn")).toMatchSnapshot();
  });

  test("returns mapped name for email field", () => {
    expect(resolveColumnNameSafe(fields, "email")).toMatchSnapshot();
  });

  test("returns key unchanged for missing field (no throw)", () => {
    const result = resolveColumnNameSafe(fields, "someArbitraryKey");
    expect(result).toBe("someArbitraryKey");
  });

  test("returns the column name for id field (key equals name)", () => {
    expect(resolveColumnNameSafe(fields, "id")).toMatchSnapshot();
  });

  test("returns the key itself with empty fields array", () => {
    expect(resolveColumnNameSafe([], "anyKey")).toMatchSnapshot();
  });
});
