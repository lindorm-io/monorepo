import { diffEnums } from "../../../../drivers/postgres/utils/sync/diff-enums.js";
import { describe, expect, test } from "vitest";

describe("diffEnums", () => {
  test("should create new enum type", () => {
    const ops = diffEnums(
      [],
      [{ schema: "public", name: "enum_status", values: ["active", "inactive"] }],
    );
    expect(ops).toMatchSnapshot();
  });

  test("should add new enum values", () => {
    const ops = diffEnums(
      [{ schema: "public", name: "enum_status", values: ["active", "inactive"] }],
      [
        {
          schema: "public",
          name: "enum_status",
          values: ["active", "inactive", "banned"],
        },
      ],
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("add_enum_value");
    expect(ops[0].autocommit).toBe(true);
    expect(ops).toMatchSnapshot();
  });

  test("should warn about stale values with warn_only type", () => {
    const ops = diffEnums(
      [{ schema: "public", name: "enum_status", values: ["active", "inactive", "old"] }],
      [{ schema: "public", name: "enum_status", values: ["active", "inactive"] }],
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("warn_only");
    expect(ops[0].severity).toBe("warning");
    expect(ops[0].description).toContain("old");
  });

  test("should return empty for matching enums", () => {
    const ops = diffEnums(
      [{ schema: "public", name: "enum_status", values: ["active", "inactive"] }],
      [{ schema: "public", name: "enum_status", values: ["active", "inactive"] }],
    );
    expect(ops).toHaveLength(0);
  });

  test("should handle multiple enums", () => {
    const ops = diffEnums(
      [{ schema: "public", name: "enum_status", values: ["active"] }],
      [
        { schema: "public", name: "enum_status", values: ["active", "inactive"] },
        { schema: "public", name: "enum_role", values: ["admin", "user"] },
      ],
    );
    expect(ops.filter((o) => o.type === "create_enum")).toHaveLength(1);
    expect(ops.filter((o) => o.type === "add_enum_value")).toHaveLength(1);
  });
});
