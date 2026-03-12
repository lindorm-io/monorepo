import { ProteusError } from "../../../../errors";
import { extractEnumValues } from "./extract-enum-values";

// --- String enums ---

describe("extractEnumValues — string enums", () => {
  it("should extract string values from a string enum", () => {
    enum Role {
      Admin = "admin",
      User = "user",
      Guest = "guest",
    }
    expect(extractEnumValues(Role as any)).toMatchSnapshot();
  });

  it("should return values in key-declaration order", () => {
    enum Status {
      Active = "active",
      Inactive = "inactive",
      Pending = "pending",
    }
    const result = extractEnumValues(Status as any);
    // For string enums, the string value is used (not the key)
    expect(result).toEqual(["active", "inactive", "pending"]);
  });

  it("should use the string value (not the key) for string-valued members", () => {
    enum Direction {
      North = "NORTH",
      South = "SOUTH",
    }
    const result = extractEnumValues(Direction as any);
    // String values are used directly: "NORTH", "SOUTH"
    expect(result).toEqual(["NORTH", "SOUTH"]);
    expect(result).toMatchSnapshot();
  });
});

// --- Numeric enums ---

describe("extractEnumValues — numeric enums", () => {
  it("should use the key (not the numeric value) for numeric enum members", () => {
    enum Severity {
      Low,
      Medium,
      High,
    }
    const result = extractEnumValues(Severity as any);
    // numeric enums produce reverse mappings, so only non-numeric keys should be kept
    expect(result).toEqual(["Low", "Medium", "High"]);
    expect(result).toMatchSnapshot();
  });

  it("should skip numeric reverse-mapping keys", () => {
    enum Count {
      Zero,
      One,
      Two,
    }
    // TypeScript numeric enums have { "0": "Zero", "1": "One", ..., "Zero": 0, ... }
    const result = extractEnumValues(Count as any);
    result.forEach((v) => expect(isNaN(Number(v))).toBe(true));
  });

  it("should handle explicit numeric values", () => {
    enum Priority {
      Low = 10,
      Medium = 20,
      High = 30,
    }
    const result = extractEnumValues(Priority as any);
    expect(result).toEqual(["Low", "Medium", "High"]);
    expect(result).toMatchSnapshot();
  });
});

// --- Mixed enums ---

describe("extractEnumValues — mixed (heterogeneous) enums", () => {
  it("should handle mixed string/number enum", () => {
    // Heterogeneous enums (numeric + string members)
    const mixedEnum = { Yes: "yes", No: 0, 0: "No" } as Record<string, string | number>;
    const result = extractEnumValues(mixedEnum);
    // "Yes" → string value "yes", "No" → numeric, emit key "No"
    expect(result).toMatchSnapshot();
  });
});

// --- Edge cases ---

describe("extractEnumValues — edge cases", () => {
  it("should return empty array for empty object", () => {
    const result = extractEnumValues({});
    expect(result).toEqual([]);
  });

  it("should handle a single-value enum", () => {
    const singleEnum = { Only: "only" };
    const result = extractEnumValues(singleEnum);
    // String value "only" is used
    expect(result).toEqual(["only"]);
  });

  it("should return unique values (no duplicates from reverse mapping)", () => {
    enum Bit {
      Off = 0,
      On = 1,
    }
    const result = extractEnumValues(Bit as any);
    const unique = [...new Set(result)];
    expect(result).toEqual(unique);
  });
});

// --- Error cases ---

describe("extractEnumValues — error cases", () => {
  it("should throw ProteusError for null input", () => {
    expect(() => extractEnumValues(null as any)).toThrow(
      "Enum definition must be a TypeScript enum object",
    );
  });

  it("should throw ProteusError for non-object input (string)", () => {
    expect(() => extractEnumValues("admin" as any)).toThrow(
      "Enum definition must be a TypeScript enum object",
    );
  });

  it("should throw ProteusError for non-object input (number)", () => {
    expect(() => extractEnumValues(42 as any)).toThrow(
      "Enum definition must be a TypeScript enum object",
    );
  });

  it("should throw ProteusError for array input", () => {
    // Arrays are objects but isObjectLike rejects them (!Array.isArray check)
    expect(() => extractEnumValues(["admin", "user"] as any)).toThrow(ProteusError);
  });
});
