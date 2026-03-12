import { normalizeDefaultExpressions } from "./normalize-default-expressions";

describe("normalizeDefaultExpressions", () => {
  test("should return null for null input", () => {
    expect(normalizeDefaultExpressions(null)).toBeNull();
  });

  test("should strip type casts", () => {
    expect(normalizeDefaultExpressions("'hello'::text")).toBe("'hello'");
  });

  test("should strip enum type casts", () => {
    expect(normalizeDefaultExpressions("'active'::enum_users_status")).toBe("'active'");
  });

  test("should strip integer casts with parens", () => {
    expect(normalizeDefaultExpressions("(0)::integer")).toBe("0");
  });

  test("should preserve function calls", () => {
    expect(normalizeDefaultExpressions("gen_random_uuid()")).toBe("gen_random_uuid()");
  });

  test("should preserve now()", () => {
    expect(normalizeDefaultExpressions("now()")).toBe("now()");
  });

  test("should normalize NULL to null", () => {
    expect(normalizeDefaultExpressions("NULL::text")).toBeNull();
    expect(normalizeDefaultExpressions("NULL")).toBeNull();
  });

  test("should handle boolean values", () => {
    expect(normalizeDefaultExpressions("true")).toBe("true");
    expect(normalizeDefaultExpressions("false")).toBe("false");
  });

  test("should handle numeric literals", () => {
    expect(normalizeDefaultExpressions("42")).toBe("42");
    expect(normalizeDefaultExpressions("3.14")).toBe("3.14");
  });

  test("should strip nested parens", () => {
    expect(normalizeDefaultExpressions("((0))")).toBe("0");
  });

  test("should handle string with single quotes", () => {
    expect(normalizeDefaultExpressions("'default_value'::character varying")).toBe(
      "'default_value'",
    );
  });

  test("should handle whitespace", () => {
    expect(normalizeDefaultExpressions("  'test'::text  ")).toBe("'test'");
  });

  test("should strip chained casts", () => {
    expect(normalizeDefaultExpressions("'value'::schema.enum::text")).toBe("'value'");
  });

  test("should strip schema-qualified enum casts", () => {
    expect(normalizeDefaultExpressions('\'active\'::"public"."enum_status"')).toBe(
      "'active'",
    );
  });

  test("should strip casts with precision", () => {
    expect(normalizeDefaultExpressions("0::numeric(10,2)")).toBe("0");
  });

  test("should strip timestamp with time zone cast", () => {
    expect(normalizeDefaultExpressions("'2024-01-01'::timestamp with time zone")).toBe(
      "'2024-01-01'",
    );
  });

  test("should strip timestamp(3) with time zone cast", () => {
    expect(normalizeDefaultExpressions("'2024-01-01'::timestamp(3) with time zone")).toBe(
      "'2024-01-01'",
    );
  });

  test("should NOT strip casts inside function calls", () => {
    expect(normalizeDefaultExpressions("date_trunc('day'::text, now())")).toBe(
      "date_trunc('day'::text, now())",
    );
  });

  test("should preserve complex function expressions", () => {
    expect(normalizeDefaultExpressions("COALESCE(col, 'default'::text)")).toBe(
      "COALESCE(col, 'default'::text)",
    );
  });

  test("should strip array type casts", () => {
    expect(normalizeDefaultExpressions("'{}'::integer[]")).toBe("'{}'");
    expect(normalizeDefaultExpressions("'{}'::text[]")).toBe("'{}'");
    expect(normalizeDefaultExpressions("ARRAY[]::varchar(255)[]")).toBe("ARRAY[]");
  });

  test("should preserve casts inside function calls (regclass)", () => {
    expect(normalizeDefaultExpressions("nextval('items_id_seq'::regclass)")).toBe(
      "nextval('items_id_seq'::regclass)",
    );
  });
});
