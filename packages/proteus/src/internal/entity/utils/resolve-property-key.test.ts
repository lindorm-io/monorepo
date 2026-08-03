import { describe, expect, test } from "vitest";
import type { MetaField } from "../types/metadata.js";
import { resolvePropertyKey } from "./resolve-property-key.js";

const fields = (...pairs: Array<[string, string]>): Array<MetaField> =>
  pairs.map(([key, name]) => ({ key, name })) as Array<MetaField>;

describe("resolvePropertyKey", () => {
  test("should map a renamed column back to its declared property key", () => {
    expect(resolvePropertyKey(fields(["authorId", "author_id"]), "author_id")).toBe(
      "authorId",
    );
  });

  test("should camelCase an auto-projected column that has no declared field", () => {
    expect(resolvePropertyKey(fields(["id", "id"]), "parent_id")).toBe("parentId");
  });

  test("should leave a property key untouched when no field carries it as a column", () => {
    expect(resolvePropertyKey(fields(["authorId", "author_id"]), "authorId")).toBe(
      "authorId",
    );
  });

  test("should be a no-op under a non-renaming strategy", () => {
    expect(resolvePropertyKey(fields(["authorId", "authorId"]), "authorId")).toBe(
      "authorId",
    );
  });

  test("should prefer an explicit @Field name over the camelCase fallback", () => {
    // `@Field({ name: "author_fk" })` — the column does not camelCase back to
    // the property key, so only the declared mapping can resolve it.
    expect(resolvePropertyKey(fields(["authorId", "author_fk"]), "author_fk")).toBe(
      "authorId",
    );
  });
});
