import { filterHiddenSelections } from "./filter-hidden-selections";
import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "../../entity/types/metadata";
import type { QueryScope } from "../../entity/types/metadata";
import { describe, expect, test } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeMetadata = (fields: ReturnType<typeof makeField>[]): EntityMetadata =>
  ({ fields }) as unknown as EntityMetadata;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("filterHiddenSelections", () => {
  // ─── explicitSelect present ─────────────────────────────────────────

  describe("when explicitSelect is provided", () => {
    test("returns explicitSelect unchanged regardless of hidden fields", () => {
      const metadata = makeMetadata([
        makeField("id"),
        makeField("secret", { hideOn: ["single", "multiple"] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single"], ["id", "secret"]);

      expect(result).toMatchSnapshot();
      expect(result).toEqual(["id", "secret"]);
    });

    test("returns explicitSelect unchanged when it is an empty array", () => {
      const metadata = makeMetadata([makeField("id")]);

      const result = filterHiddenSelections(metadata, ["single"], []);

      expect(result).toEqual([]);
    });

    test("returns explicitSelect without consulting hidden metadata", () => {
      const metadata = makeMetadata([makeField("id"), makeField("name")]);

      const result = filterHiddenSelections(metadata, ["single", "multiple"], ["name"]);

      expect(result).toEqual(["name"]);
    });
  });

  // ─── no hidden fields at all ────────────────────────────────────────

  describe("when no fields are hidden", () => {
    test("returns null when no fields have hideOn matching the categories", () => {
      const metadata = makeMetadata([
        makeField("id", { hideOn: [] }),
        makeField("name", { hideOn: [] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      expect(result).toBeNull();
    });

    test("returns null when fields have hideOn that does not match provided categories", () => {
      const metadata = makeMetadata([
        makeField("id", { hideOn: ["multiple"] }),
        makeField("name", { hideOn: [] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      expect(result).toBeNull();
    });

    test("returns null for empty fields array", () => {
      const metadata = makeMetadata([]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      expect(result).toBeNull();
    });

    test("returns null when categories array is empty", () => {
      const metadata = makeMetadata([makeField("id", { hideOn: ["single"] })]);
      const categories: Array<QueryScope> = [];

      const result = filterHiddenSelections(metadata, categories, null);

      expect(result).toBeNull();
    });
  });

  // ─── hidden fields present ──────────────────────────────────────────

  describe("when some fields are hidden for the given category", () => {
    test("returns field keys excluding hidden ones", () => {
      const metadata = makeMetadata([
        makeField("id", { hideOn: [] }),
        makeField("name", { hideOn: [] }),
        makeField("password", { hideOn: ["single"] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      expect(result).toMatchSnapshot();
      expect(result).toEqual(["id", "name"]);
    });

    test("excludes field hidden for 'multiple' when category is multiple", () => {
      const metadata = makeMetadata([
        makeField("id", { hideOn: [] }),
        makeField("bulkHidden", { hideOn: ["multiple"] }),
        makeField("name", { hideOn: [] }),
      ]);

      const result = filterHiddenSelections(metadata, ["multiple"], null);

      expect(result).toMatchSnapshot();
      expect(result).not.toContain("bulkHidden");
      expect(result).toContain("id");
      expect(result).toContain("name");
    });

    test("excludes field when it is hidden for any of the provided categories", () => {
      const metadata = makeMetadata([
        makeField("id", { hideOn: [] }),
        makeField("singleOnly", { hideOn: ["single"] }),
        makeField("multiOnly", { hideOn: ["multiple"] }),
        makeField("both", { hideOn: ["single", "multiple"] }),
        makeField("visible", { hideOn: [] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single", "multiple"], null);

      expect(result).toMatchSnapshot();
      expect(result).toEqual(["id", "visible"]);
    });

    test("includes field hidden for 'multiple' when category is only 'single'", () => {
      const metadata = makeMetadata([
        makeField("id", { hideOn: [] }),
        makeField("multiHidden", { hideOn: ["multiple"] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      // No field is hidden for "single" so should return null (no hidden fields match)
      expect(result).toBeNull();
    });

    test("returns empty array when all fields are hidden for the category", () => {
      const metadata = makeMetadata([
        makeField("a", { hideOn: ["single"] }),
        makeField("b", { hideOn: ["single"] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      expect(result).toEqual([]);
    });

    test("result array preserves field order from metadata", () => {
      const metadata = makeMetadata([
        makeField("c", { hideOn: [] }),
        makeField("a", { hideOn: [] }),
        makeField("b", { hideOn: ["single"] }),
      ]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      expect(result).toMatchSnapshot();
      expect(result).toEqual(["c", "a"]);
    });
  });

  // ─── explicitSelect null, no hidden fields present ──────────────────

  describe("boundary — null explicitSelect with no hidden fields", () => {
    test("returns null when explicitSelect is null and no fields are hidden", () => {
      const metadata = makeMetadata([makeField("id"), makeField("name")]);

      const result = filterHiddenSelections(metadata, ["single"], null);

      expect(result).toBeNull();
    });
  });
});
