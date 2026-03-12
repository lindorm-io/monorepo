import { makeField } from "../../__fixtures__/make-field";
import { validateFields } from "./validate-fields";

describe("validateFields", () => {
  test("should pass with distinct valid fields", () => {
    expect(() =>
      validateFields("Test", [makeField("id"), makeField("name")]),
    ).not.toThrow();
  });

  test("should pass with empty fields array", () => {
    expect(() => validateFields("Test", [])).not.toThrow();
  });

  test("should throw on duplicate field key", () => {
    expect(() => validateFields("Test", [makeField("id"), makeField("id")])).toThrow(
      "Duplicate field metadata",
    );
  });

  test("should throw on duplicate field column name (different keys, same name)", () => {
    expect(() =>
      validateFields("Test", [
        makeField("userId", { name: "user_id" }),
        makeField("userIdentifier", { name: "user_id" }),
      ]),
    ).toThrow("Duplicate field column name");
  });

  test("should throw on duplicate CreateDate field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("createdAt", { decorator: "CreateDate" }),
        makeField("alsoCreatedAt", { decorator: "CreateDate" }),
      ]),
    ).toThrow("Duplicate unique field type");
  });

  test("should throw on duplicate UpdateDate field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("updatedAt", { decorator: "UpdateDate" }),
        makeField("modifiedAt", { decorator: "UpdateDate" }),
      ]),
    ).toThrow("Duplicate unique field type");
  });

  test("should throw on duplicate Version field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("version", { decorator: "Version" }),
        makeField("ver", { decorator: "Version" }),
      ]),
    ).toThrow("Duplicate unique field type");
  });

  test("should allow multiple Scope fields", () => {
    expect(() =>
      validateFields("Test", [
        makeField("tenantId", { decorator: "Scope" }),
        makeField("region", { decorator: "Scope" }),
      ]),
    ).not.toThrow();
  });

  test("should throw on duplicate DeleteDate field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("deletedAt", { decorator: "DeleteDate" }),
        makeField("removed", { decorator: "DeleteDate" }),
      ]),
    ).toThrow("Duplicate unique field type");
  });

  test("should throw on duplicate ExpiryDate field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("expiresAt", { decorator: "ExpiryDate" }),
        makeField("expiresAt2", { decorator: "ExpiryDate" }),
      ]),
    ).toThrow("Duplicate unique field type");
  });

  test("should throw on duplicate VersionStartDate field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("startAt", { decorator: "VersionStartDate" }),
        makeField("startAt2", { decorator: "VersionStartDate" }),
      ]),
    ).toThrow("Duplicate unique field type");
  });

  test("should throw on duplicate VersionEndDate field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("endAt", { decorator: "VersionEndDate" }),
        makeField("endAt2", { decorator: "VersionEndDate" }),
      ]),
    ).toThrow("Duplicate unique field type");
  });

  // ─── @Precision field-type validation ───────────────────────────────

  test("should throw when @Precision is on a string field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("name", { type: "string", precision: 10, scale: 2 }),
      ]),
    ).toThrow("@Precision");
  });

  test("should throw when @Precision is on an integer field", () => {
    expect(() =>
      validateFields("Test", [makeField("count", { type: "integer", precision: 10 })]),
    ).toThrow("@Precision");
  });

  test("should throw when @Precision is on a field with no type", () => {
    expect(() =>
      validateFields("Test", [makeField("val", { type: null, precision: 5 })]),
    ).toThrow("@Precision");
  });

  test("should not throw when @Precision is on a decimal field", () => {
    expect(() =>
      validateFields("Test", [
        makeField("price", { type: "decimal", precision: 10, scale: 2 }),
      ]),
    ).not.toThrow();
  });

  test("should not throw when @Precision is on a float field", () => {
    expect(() =>
      validateFields("Test", [makeField("ratio", { type: "float", precision: 8 })]),
    ).not.toThrow();
  });

  test("should not throw when @Precision is on a real field", () => {
    expect(() =>
      validateFields("Test", [makeField("score", { type: "real", precision: 6 })]),
    ).not.toThrow();
  });

  // ─── @Enum field-type validation ────────────────────────────────────

  test("should throw when @Enum is on a string field", () => {
    const Status = { Active: "active", Inactive: "inactive" };
    expect(() =>
      validateFields("Test", [makeField("status", { type: "string", enum: Status })]),
    ).toThrow("@Enum");
  });

  test("should throw when @Enum is on an integer field", () => {
    const Priority = { Low: 1, High: 2 };
    expect(() =>
      validateFields("Test", [
        makeField("priority", { type: "integer", enum: Priority }),
      ]),
    ).toThrow("@Enum");
  });

  test("should throw when enum type field is missing @Enum values", () => {
    expect(() =>
      validateFields("Test", [makeField("status", { type: "enum", enum: null })]),
    ).toThrow("requires an @Enum decorator");
  });

  test("should not throw when enum type field has @Enum values", () => {
    const Color = { Red: "red", Blue: "blue" };
    expect(() =>
      validateFields("Test", [makeField("color", { type: "enum", enum: Color })]),
    ).not.toThrow();
  });
});
