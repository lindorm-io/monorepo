import { normalizePgType } from "../../../../drivers/postgres/utils/sync/normalize-pg-type";

describe("normalizePgType", () => {
  // Direct aliases
  it.each([
    ["boolean", "BOOLEAN"],
    ["smallint", "SMALLINT"],
    ["integer", "INTEGER"],
    ["bigint", "BIGINT"],
    ["real", "REAL"],
    ["double precision", "DOUBLE PRECISION"],
    ["text", "TEXT"],
    ["uuid", "UUID"],
    ["date", "DATE"],
    ["timestamp without time zone", "TIMESTAMP"],
    ["time without time zone", "TIME"],
    ["time with time zone", "TIMETZ"],
    ["interval", "INTERVAL"],
    ["bytea", "BYTEA"],
    ["jsonb", "JSONB"],
    ["json", "JSON"],
    ["inet", "INET"],
    ["cidr", "CIDR"],
    ["macaddr", "MACADDR"],
    ["point", "POINT"],
    ["line", "LINE"],
    ["lseg", "LSEG"],
    ["box", "BOX"],
    ["path", "PATH"],
    ["polygon", "POLYGON"],
    ["circle", "CIRCLE"],
    ["xml", "XML"],
  ])("should normalize %s → %s", (input, expected) => {
    expect(normalizePgType(input)).toBe(expected);
  });

  // Parametric types
  it.each([
    ["timestamp(3) with time zone", "TIMESTAMPTZ(3)"],
    ["timestamp(6) with time zone", "TIMESTAMPTZ(6)"],
    ["timestamp with time zone", "TIMESTAMPTZ(6)"],
    ["character varying(255)", "VARCHAR(255)"],
    ["character varying(50)", "VARCHAR(50)"],
    ["character varying", "TEXT"],
    ["numeric(10,2)", "NUMERIC(10, 2)"],
    ["numeric(5)", "NUMERIC(5)"],
    ["numeric", "NUMERIC"],
    ["vector(1536)", "VECTOR(1536)"],
    ["vector", "VECTOR"],
  ])("should normalize %s → %s", (input, expected) => {
    expect(normalizePgType(input)).toBe(expected);
  });

  // Array types
  it.each([
    ["integer[]", "INTEGER[]"],
    ["text[]", "TEXT[]"],
    ["uuid[]", "UUID[]"],
    ["boolean[]", "BOOLEAN[]"],
  ])("should normalize %s → %s", (input, expected) => {
    expect(normalizePgType(input)).toBe(expected);
  });

  // USER-DEFINED (enums) — pass through as-is
  it("should pass through enum type names", () => {
    expect(normalizePgType("enum_users_status")).toBe("enum_users_status");
  });

  it("should pass through schema-qualified enum type names", () => {
    expect(normalizePgType("myschema.enum_users_role")).toBe("myschema.enum_users_role");
  });

  // Whitespace handling
  it("should trim whitespace", () => {
    expect(normalizePgType("  integer  ")).toBe("INTEGER");
  });
});
