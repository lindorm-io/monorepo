import { extractCursorValues } from "./extract-cursor-values";

describe("extractCursorValues", () => {
  it("should extract values aligned with keyset entries", () => {
    const entity = {
      createdAt: new Date("2024-01-15T10:00:00Z"),
      id: "abc-123",
      name: "test",
    };
    const entries = [
      { column: "createdAt", direction: "ASC" as const },
      { column: "id", direction: "ASC" as const },
    ];

    const result = extractCursorValues(entity, entries);
    expect(result).toMatchSnapshot();
  });

  it("should serialize Date values to ISO strings", () => {
    const date = new Date("2024-06-15T12:30:00.000Z");
    const entity = { timestamp: date, id: 42 };
    const entries = [
      { column: "timestamp", direction: "DESC" as const },
      { column: "id", direction: "ASC" as const },
    ];

    const result = extractCursorValues(entity, entries);
    expect(result[0]).toBe("2024-06-15T12:30:00.000Z");
    expect(result[1]).toBe(42);
  });

  it("should convert null/undefined values to null", () => {
    const entity = { name: null, id: "abc" };
    const entries = [
      { column: "name", direction: "ASC" as const },
      { column: "id", direction: "ASC" as const },
    ];

    const result = extractCursorValues(entity, entries);
    expect(result[0]).toBeNull();
    expect(result[1]).toBe("abc");
  });

  it("should handle missing properties as null", () => {
    const entity = { id: "abc" } as any;
    const entries = [
      { column: "missing", direction: "ASC" as const },
      { column: "id", direction: "ASC" as const },
    ];

    const result = extractCursorValues(entity, entries);
    expect(result[0]).toBeNull();
    expect(result[1]).toBe("abc");
  });

  it("should handle numeric and string values", () => {
    const entity = { score: 95.5, name: "alice", id: 1 };
    const entries = [
      { column: "score", direction: "DESC" as const },
      { column: "name", direction: "ASC" as const },
      { column: "id", direction: "ASC" as const },
    ];

    const result = extractCursorValues(entity, entries);
    expect(result).toMatchSnapshot();
  });
});
