import { makeField } from "../../../__fixtures__/make-field";
import { ProteusError } from "../../../../errors";
import { mapFieldType } from "./map-field-type";

const TABLE = "test_table";
const NS = null;
const NS_SCOPED = "myschema";

describe("mapFieldType", () => {
  describe("boolean", () => {
    test("boolean → BOOLEAN", () => {
      expect(
        mapFieldType(makeField("testField", { type: "boolean" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("integer types", () => {
    test("smallint → SMALLINT", () => {
      expect(
        mapFieldType(makeField("testField", { type: "smallint" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("integer → INTEGER", () => {
      expect(
        mapFieldType(makeField("testField", { type: "integer" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("bigint → BIGINT", () => {
      expect(
        mapFieldType(makeField("testField", { type: "bigint" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("floating point types", () => {
    test("real → REAL", () => {
      expect(
        mapFieldType(makeField("testField", { type: "real" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("float → DOUBLE PRECISION", () => {
      expect(
        mapFieldType(makeField("testField", { type: "float" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("decimal without precision or scale → NUMERIC", () => {
      expect(
        mapFieldType(makeField("testField", { type: "decimal" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("decimal with precision only → NUMERIC(p)", () => {
      expect(
        mapFieldType(
          makeField("testField", { type: "decimal", precision: 10 }),
          TABLE,
          NS,
        ),
      ).toMatchSnapshot();
    });

    test("decimal with precision and scale → NUMERIC(p, s)", () => {
      expect(
        mapFieldType(
          makeField("testField", { type: "decimal", precision: 10, scale: 2 }),
          TABLE,
          NS,
        ),
      ).toMatchSnapshot();
    });

    // scale alone is silently ignored — the condition requires both precision and scale,
    // so only precision is checked in the fallback branch.
    test("decimal with scale but no precision → NUMERIC (scale is ignored)", () => {
      expect(
        mapFieldType(makeField("testField", { type: "decimal", scale: 4 }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("string types", () => {
    test("string without max → TEXT", () => {
      expect(
        mapFieldType(makeField("testField", { type: "string" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("string with max → VARCHAR(n)", () => {
      expect(
        mapFieldType(makeField("testField", { type: "string", max: 255 }), TABLE, NS),
      ).toMatchSnapshot();
    });

    // max: 0 is falsy — the `!max` guard treats it the same as null, so TEXT is returned instead of VARCHAR(0).
    test("string with max=0 → TEXT (falsy-zero falls through to TEXT)", () => {
      expect(
        mapFieldType(makeField("testField", { type: "string", max: 0 }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("varchar with max → VARCHAR(n)", () => {
      expect(
        mapFieldType(makeField("testField", { type: "varchar", max: 100 }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("varchar without max throws ProteusError", () => {
      expect(() =>
        mapFieldType(makeField("testField", { type: "varchar" }), TABLE, NS),
      ).toThrow(ProteusError);
    });

    // max: 0 is falsy — the `!max` guard throws even though 0 was explicitly provided.
    test("varchar with max=0 throws ProteusError (falsy-zero treated as missing)", () => {
      expect(() =>
        mapFieldType(makeField("testField", { type: "varchar", max: 0 }), TABLE, NS),
      ).toThrow(ProteusError);
    });

    test("text → TEXT", () => {
      expect(
        mapFieldType(makeField("testField", { type: "text" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("uuid → UUID", () => {
      expect(
        mapFieldType(makeField("testField", { type: "uuid" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("enum without namespace → unqualified enum type name", () => {
      expect(
        mapFieldType(makeField("testField", { type: "enum" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("enum with namespace → schema-qualified enum type name", () => {
      expect(
        mapFieldType(makeField("testField", { type: "enum" }), TABLE, NS_SCOPED),
      ).toMatchSnapshot();
    });
  });

  describe("date/time types", () => {
    test("date → DATE", () => {
      expect(
        mapFieldType(makeField("testField", { type: "date" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("time → TIME", () => {
      expect(
        mapFieldType(makeField("testField", { type: "time" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("timestamp → TIMESTAMPTZ(3)", () => {
      expect(
        mapFieldType(makeField("testField", { type: "timestamp" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("interval → INTERVAL", () => {
      expect(
        mapFieldType(makeField("testField", { type: "interval" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("binary type", () => {
    test("binary → BYTEA", () => {
      expect(
        mapFieldType(makeField("testField", { type: "binary" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("structured types", () => {
    test("json → JSONB", () => {
      expect(
        mapFieldType(makeField("testField", { type: "json" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("object → JSONB", () => {
      expect(
        mapFieldType(makeField("testField", { type: "object" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("array without arrayType → JSONB fallback", () => {
      expect(
        mapFieldType(makeField("testField", { type: "array" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("array with integer arrayType → INTEGER[]", () => {
      expect(
        mapFieldType(
          makeField("testField", { type: "array", arrayType: "integer" }),
          TABLE,
          NS,
        ),
      ).toMatchSnapshot();
    });

    test("array with text arrayType → TEXT[]", () => {
      expect(
        mapFieldType(
          makeField("testField", { type: "array", arrayType: "text" }),
          TABLE,
          NS,
        ),
      ).toMatchSnapshot();
    });

    test("array with uuid arrayType → UUID[]", () => {
      expect(
        mapFieldType(
          makeField("testField", { type: "array", arrayType: "uuid" }),
          TABLE,
          NS,
        ),
      ).toMatchSnapshot();
    });

    // arrayType: "enum" is resolved recursively — the inner mapFieldType call for the enum
    // element type produces the qualified enum type name, then [] is appended.
    test("array with enum arrayType → <enum_type_name>[]", () => {
      expect(
        mapFieldType(
          makeField("testField", { type: "array", arrayType: "enum" }),
          TABLE,
          NS,
        ),
      ).toMatchSnapshot();
    });

    test("array with enum arrayType with namespace → schema-qualified enum type name[]", () => {
      expect(
        mapFieldType(
          makeField("testField", { type: "array", arrayType: "enum" }),
          TABLE,
          NS_SCOPED,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("network types", () => {
    test("inet → INET", () => {
      expect(
        mapFieldType(makeField("testField", { type: "inet" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("cidr → CIDR", () => {
      expect(
        mapFieldType(makeField("testField", { type: "cidr" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("macaddr → MACADDR", () => {
      expect(
        mapFieldType(makeField("testField", { type: "macaddr" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("geometric types", () => {
    test("point → POINT", () => {
      expect(
        mapFieldType(makeField("testField", { type: "point" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("line → LINE", () => {
      expect(
        mapFieldType(makeField("testField", { type: "line" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("lseg → LSEG", () => {
      expect(
        mapFieldType(makeField("testField", { type: "lseg" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("box → BOX", () => {
      expect(
        mapFieldType(makeField("testField", { type: "box" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("path → PATH", () => {
      expect(
        mapFieldType(makeField("testField", { type: "path" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("polygon → POLYGON", () => {
      expect(
        mapFieldType(makeField("testField", { type: "polygon" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("circle → CIRCLE", () => {
      expect(
        mapFieldType(makeField("testField", { type: "circle" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("vector type", () => {
    test("vector without max → VECTOR", () => {
      expect(
        mapFieldType(makeField("testField", { type: "vector" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("vector with max → VECTOR(n)", () => {
      expect(
        mapFieldType(makeField("testField", { type: "vector", max: 1536 }), TABLE, NS),
      ).toMatchSnapshot();
    });

    // max: 0 is falsy — the `!max` guard treats it the same as null, so bare VECTOR is returned.
    test("vector with max=0 → VECTOR (falsy-zero falls through to bare VECTOR)", () => {
      expect(
        mapFieldType(makeField("testField", { type: "vector", max: 0 }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("xml type", () => {
    test("xml → XML", () => {
      expect(
        mapFieldType(makeField("testField", { type: "xml" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("logical types (stored as TEXT)", () => {
    test("email → TEXT", () => {
      expect(
        mapFieldType(makeField("testField", { type: "email" }), TABLE, NS),
      ).toMatchSnapshot();
    });

    test("url → TEXT", () => {
      expect(
        mapFieldType(makeField("testField", { type: "url" }), TABLE, NS),
      ).toMatchSnapshot();
    });
  });

  describe("error cases", () => {
    test("throws ProteusError when type is null", () => {
      expect(() =>
        mapFieldType(makeField("testField", { type: null }), TABLE, NS),
      ).toThrow(ProteusError);
    });

    test("throws ProteusError for unsupported type", () => {
      expect(() =>
        mapFieldType(makeField("testField", { type: "unknown" as any }), TABLE, NS),
      ).toThrow(ProteusError);
    });
  });
});
