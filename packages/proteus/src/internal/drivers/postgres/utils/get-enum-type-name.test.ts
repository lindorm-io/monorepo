import { getEnumTypeName } from "./get-enum-type-name";
import { hashIdentifier } from "./hash-identifier";

describe("getEnumTypeName", () => {
  test("returns readable name when result is exactly 63 characters", () => {
    // Craft a combination that lands at exactly 63 chars:
    // "enum_" (5) + tableName + "_" + fieldKey = 63
    // tableName + fieldKey = 57 chars total including the separator
    const tableName = "a".repeat(30);
    const fieldKey = "b".repeat(27); // 5 + 30 + 1 + 27 = 63
    const result = getEnumTypeName(tableName, fieldKey);
    expect(result).toBe(`enum_${tableName}_${fieldKey}`);
    expect(result.length).toBe(63);
  });

  test("returns readable name for a short table and field", () => {
    expect(getEnumTypeName("users", "status")).toMatchSnapshot();
  });

  test("returns readable name when result is under 63 characters", () => {
    const result = getEnumTypeName("orders", "state");
    expect(result).toBe("enum_orders_state");
  });

  test("falls back to hash when readable name exceeds 63 characters", () => {
    const tableName = "a".repeat(32);
    const fieldKey = "b".repeat(32); // 5 + 32 + 1 + 32 = 70 > 63
    const result = getEnumTypeName(tableName, fieldKey);
    expect(result).toBe(`enum_${hashIdentifier(`${tableName}_${fieldKey}`)}`);
    expect(result.length).toBe(5 + 11); // "enum_" + 11-char hash
  });

  test("snapshot for a typical enum field name", () => {
    expect(getEnumTypeName("product", "category")).toMatchSnapshot();
  });

  test("snapshot for a long name that triggers hashing", () => {
    expect(
      getEnumTypeName(
        "very_long_table_name_for_testing",
        "very_long_field_name_for_testing",
      ),
    ).toMatchSnapshot();
  });
});
