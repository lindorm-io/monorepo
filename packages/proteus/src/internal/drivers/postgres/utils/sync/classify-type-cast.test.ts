import { classifyTypeCast } from "../../../../drivers/postgres/utils/sync/classify-type-cast.js";
import { describe, expect, it } from "vitest";

describe("classifyTypeCast", () => {
  it("should return none for identical types", () => {
    expect(classifyTypeCast("INTEGER", "INTEGER")).toEqual({ action: "none" });
    expect(classifyTypeCast("TEXT", "TEXT")).toEqual({ action: "none" });
    expect(classifyTypeCast("UUID", "UUID")).toEqual({ action: "none" });
  });

  // Safe implicit casts
  it.each([
    ["SMALLINT", "INTEGER"],
    ["SMALLINT", "BIGINT"],
    ["INTEGER", "BIGINT"],
    ["REAL", "DOUBLE PRECISION"],
    ["VARCHAR", "TEXT"],
    ["TEXT", "VARCHAR"], // unlimited VARCHAR (no parens) is safe — equivalent to TEXT
  ])("should classify %s → %s as safe alter", (from, to) => {
    expect(classifyTypeCast(from, to)).toEqual({ action: "alter" });
  });

  // VARCHAR widening
  it("should classify VARCHAR(50) → VARCHAR(255) as safe alter", () => {
    expect(classifyTypeCast("VARCHAR(50)", "VARCHAR(255)")).toEqual({ action: "alter" });
  });

  it("should classify VARCHAR(50) → VARCHAR (unlimited, no parens) as safe alter", () => {
    expect(classifyTypeCast("VARCHAR(50)", "VARCHAR")).toMatchSnapshot();
  });

  // VARCHAR narrowing — needs USING
  it("should classify VARCHAR(255) → VARCHAR(50) as alter_using", () => {
    const result = classifyTypeCast("VARCHAR(255)", "VARCHAR(50)");
    expect(result).toEqual({ action: "alter_using", using: "col::varchar(50)" });
  });

  // Same base type, different params
  it("should classify NUMERIC(10, 2) → NUMERIC(12, 4) as safe alter", () => {
    expect(classifyTypeCast("NUMERIC(10, 2)", "NUMERIC(12, 4)")).toEqual({
      action: "alter",
    });
  });

  it("should classify TIMESTAMPTZ(3) → TIMESTAMPTZ(6) as safe alter", () => {
    expect(classifyTypeCast("TIMESTAMPTZ(3)", "TIMESTAMPTZ(6)")).toEqual({
      action: "alter",
    });
  });

  // USING casts
  it.each([
    ["TEXT", "UUID", "col::uuid"],
    ["TEXT", "INTEGER", "col::integer"],
    ["INTEGER", "TEXT", "col::text"],
    ["UUID", "TEXT", "col::text"],
    ["BOOLEAN", "TEXT", "col::text"],
    ["TEXT", "BOOLEAN", "col::boolean"],
    ["BIGINT", "NUMERIC", "col::numeric"],
  ])("should classify %s → %s as alter_using with %s", (from, to, using) => {
    expect(classifyTypeCast(from, to)).toEqual({ action: "alter_using", using });
  });

  // TEXT → VARCHAR(N) — needs USING (potential truncation)
  it("should classify TEXT → VARCHAR(255) as alter_using", () => {
    expect(classifyTypeCast("TEXT", "VARCHAR(255)")).toEqual({
      action: "alter_using",
      using: "col::varchar(255)",
    });
  });

  // NUMERIC precision narrowing — needs USING
  it("should classify NUMERIC(10, 2) → NUMERIC(8, 1) as alter_using (narrowing)", () => {
    expect(classifyTypeCast("NUMERIC(10, 2)", "NUMERIC(8, 1)")).toEqual({
      action: "alter_using",
      using: "col::numeric(8, 1)",
    });
  });

  it("should classify NUMERIC(10, 2) → NUMERIC(12, 4) as safe alter (widening)", () => {
    expect(classifyTypeCast("NUMERIC(10, 2)", "NUMERIC(12, 4)")).toEqual({
      action: "alter",
    });
  });

  // NUMERIC scale narrowing — needs USING
  it("should classify NUMERIC(8, 4) → NUMERIC(8, 1) as alter_using (scale narrowing)", () => {
    expect(classifyTypeCast("NUMERIC(8, 4)", "NUMERIC(8, 1)")).toMatchSnapshot();
  });

  // NUMERIC scale widening — safe alter
  it("should classify NUMERIC(8, 1) → NUMERIC(8, 4) as safe alter (scale widening)", () => {
    expect(classifyTypeCast("NUMERIC(8, 1)", "NUMERIC(8, 4)")).toMatchSnapshot();
  });

  // NUMERIC precision narrowing without scale — needs USING
  it("should classify NUMERIC(10) → NUMERIC(8) as alter_using (precision narrowing, no scale)", () => {
    expect(classifyTypeCast("NUMERIC(10)", "NUMERIC(8)")).toMatchSnapshot();
  });

  // TIMESTAMPTZ precision narrowing — needs USING
  it("should classify TIMESTAMPTZ(6) → TIMESTAMPTZ(3) as alter_using (narrowing)", () => {
    expect(classifyTypeCast("TIMESTAMPTZ(6)", "TIMESTAMPTZ(3)")).toEqual({
      action: "alter_using",
      using: "col::timestamptz(3)",
    });
  });

  // Incompatible — drop_readd
  it.each([
    ["INTEGER", "UUID"],
    ["TEXT", "JSONB"],
    ["UUID", "INTEGER"],
    ["BOOLEAN", "UUID"],
    ["JSONB", "TEXT"],
    ["BYTEA", "TEXT"],
  ])("should classify %s → %s as drop_readd", (from, to) => {
    expect(classifyTypeCast(from, to)).toEqual({ action: "drop_readd" });
  });
});
