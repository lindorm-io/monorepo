import { makeField } from "../../__fixtures__/make-field.js";
import { validatePrimaryKeys, validateVersionKeys } from "./validate-primary-keys.js";
import { describe, expect, test } from "vitest";

describe("validatePrimaryKeys", () => {
  test("should pass with valid primary key matching field", () => {
    expect(() =>
      validatePrimaryKeys("Test", ["id"], [makeField("id"), makeField("name")]),
    ).not.toThrow();
  });

  test("should pass with composite primary keys matching fields", () => {
    expect(() =>
      validatePrimaryKeys(
        "Test",
        ["tenantId", "userId"],
        [makeField("tenantId"), makeField("userId")],
      ),
    ).not.toThrow();
  });

  test("should throw when no primary keys", () => {
    expect(() => validatePrimaryKeys("Test", [], [makeField("id")])).toThrow(
      "Invalid @Entity",
    );
  });

  test("should throw when primary key field not in fields array", () => {
    expect(() => validatePrimaryKeys("Test", ["id"], [makeField("name")])).toThrow(
      "Primary key field not found",
    );
  });
});

describe("validateVersionKeys", () => {
  test("should pass with valid version key that is also a primary key", () => {
    expect(() =>
      validateVersionKeys(
        "Test",
        ["versionId"],
        ["id", "versionId"],
        [makeField("id"), makeField("versionId")],
      ),
    ).not.toThrow();
  });

  test("should pass with empty version keys", () => {
    expect(() =>
      validateVersionKeys("Test", [], ["id"], [makeField("id")]),
    ).not.toThrow();
  });

  test("should throw when version key field is not in fields array", () => {
    expect(() =>
      validateVersionKeys("Test", ["versionId"], ["versionId"], [makeField("id")]),
    ).toThrow("Version key field not found");
  });

  test("should throw when version key is not also a primary key", () => {
    expect(() =>
      validateVersionKeys(
        "Test",
        ["versionId"],
        ["id"],
        [makeField("id"), makeField("versionId")],
      ),
    ).toThrow("Version key must also be a primary key");
  });
});
