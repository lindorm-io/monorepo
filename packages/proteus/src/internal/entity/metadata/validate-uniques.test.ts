import { makeField } from "../../__fixtures__/make-field";
import { validateUniques } from "./validate-uniques";
import type { MetaUnique } from "../types/metadata";
import { describe, expect, test } from "vitest";

const makeUnique = (keys: Array<string>, name: string | null = null): MetaUnique => ({
  keys,
  name,
});

describe("validateUniques", () => {
  test("should pass with valid unique constraint", () => {
    const fields = [makeField("email"), makeField("name")];
    const uniques = [makeUnique(["email"])];
    expect(() => validateUniques("Test", uniques, fields)).not.toThrow();
  });

  test("should pass with composite unique constraint", () => {
    const fields = [makeField("tenantId"), makeField("email")];
    const uniques = [makeUnique(["tenantId", "email"])];
    expect(() => validateUniques("Test", uniques, fields)).not.toThrow();
  });

  test("should pass with empty uniques", () => {
    expect(() => validateUniques("Test", [], [makeField("id")])).not.toThrow();
  });

  test("should throw when unique field not found in fields", () => {
    const fields = [makeField("name")];
    const uniques = [makeUnique(["missing"])];
    expect(() => validateUniques("Test", uniques, fields)).toThrow(
      "Unique constraint field not found",
    );
  });

  test("should throw when one of composite unique fields not found", () => {
    const fields = [makeField("tenantId")];
    const uniques = [makeUnique(["tenantId", "missing"])];
    expect(() => validateUniques("Test", uniques, fields)).toThrow(
      "Unique constraint field not found",
    );
  });
});
