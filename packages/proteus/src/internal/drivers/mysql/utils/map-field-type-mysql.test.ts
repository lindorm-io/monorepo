import { makeField } from "../../../__fixtures__/make-field";
import { ProteusError } from "../../../../errors";
import { mapFieldTypeMysql } from "./map-field-type-mysql";

describe("mapFieldTypeMysql", () => {
  describe("boolean", () => {
    test("boolean -> TINYINT(1)", () => {
      expect(mapFieldTypeMysql(makeField("flag", { type: "boolean" }))).toMatchSnapshot();
    });
  });

  describe("integer types", () => {
    test("smallint -> SMALLINT", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "smallint" }))).toMatchSnapshot();
    });

    test("integer -> INT", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "integer" }))).toMatchSnapshot();
    });

    test("bigint -> BIGINT", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "bigint" }))).toMatchSnapshot();
    });
  });

  describe("floating point types", () => {
    test("real -> FLOAT", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "real" }))).toMatchSnapshot();
    });

    test("float -> DOUBLE", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "float" }))).toMatchSnapshot();
    });

    test("decimal without precision -> DECIMAL", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "decimal" }))).toMatchSnapshot();
    });

    test("decimal with precision only -> DECIMAL(p)", () => {
      expect(
        mapFieldTypeMysql(makeField("x", { type: "decimal", precision: 10 })),
      ).toMatchSnapshot();
    });

    test("decimal with precision and scale -> DECIMAL(p, s)", () => {
      expect(
        mapFieldTypeMysql(makeField("x", { type: "decimal", precision: 10, scale: 2 })),
      ).toMatchSnapshot();
    });

    test("decimal with scale but no precision -> DECIMAL (scale ignored)", () => {
      expect(
        mapFieldTypeMysql(makeField("x", { type: "decimal", scale: 4 })),
      ).toMatchSnapshot();
    });
  });

  describe("string types", () => {
    test("string without max -> VARCHAR(255)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "string" }))).toMatchSnapshot();
    });

    test("string with max -> VARCHAR(n)", () => {
      expect(
        mapFieldTypeMysql(makeField("x", { type: "string", max: 100 })),
      ).toMatchSnapshot();
    });

    test("varchar without max -> VARCHAR(255)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "varchar" }))).toMatchSnapshot();
    });

    test("varchar with max -> VARCHAR(n)", () => {
      expect(
        mapFieldTypeMysql(makeField("x", { type: "varchar", max: 50 })),
      ).toMatchSnapshot();
    });

    test("text -> TEXT", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "text" }))).toMatchSnapshot();
    });

    test("uuid -> CHAR(36)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "uuid" }))).toMatchSnapshot();
    });

    test("enum -> VARCHAR(255) fallback", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "enum" }))).toMatchSnapshot();
    });
  });

  describe("date/time types", () => {
    test("date -> DATE", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "date" }))).toMatchSnapshot();
    });

    test("time -> TIME(3)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "time" }))).toMatchSnapshot();
    });

    test("timestamp -> DATETIME(3)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "timestamp" }))).toMatchSnapshot();
    });

    test("interval -> VARCHAR(255)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "interval" }))).toMatchSnapshot();
    });
  });

  describe("binary type", () => {
    test("binary -> BLOB", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "binary" }))).toMatchSnapshot();
    });
  });

  describe("structured types", () => {
    test("json -> JSON", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "json" }))).toMatchSnapshot();
    });

    test("object -> JSON", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "object" }))).toMatchSnapshot();
    });

    test("array -> JSON", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "array" }))).toMatchSnapshot();
    });
  });

  describe("network types", () => {
    test("inet -> VARCHAR(45)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "inet" }))).toMatchSnapshot();
    });

    test("cidr -> VARCHAR(45)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "cidr" }))).toMatchSnapshot();
    });

    test("macaddr -> CHAR(17)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "macaddr" }))).toMatchSnapshot();
    });
  });

  describe("logical types", () => {
    test("email -> VARCHAR(320)", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "email" }))).toMatchSnapshot();
    });

    test("url -> TEXT", () => {
      expect(mapFieldTypeMysql(makeField("x", { type: "url" }))).toMatchSnapshot();
    });
  });

  describe("unsupported types", () => {
    for (const t of [
      "point",
      "line",
      "lseg",
      "box",
      "path",
      "polygon",
      "circle",
      "vector",
      "xml",
    ] as const) {
      test(`${t} throws ProteusError`, () => {
        expect(() => mapFieldTypeMysql(makeField("x", { type: t }))).toThrow(
          ProteusError,
        );
      });
    }
  });

  describe("error cases", () => {
    test("null type throws ProteusError", () => {
      expect(() => mapFieldTypeMysql(makeField("x", { type: null }))).toThrow(
        ProteusError,
      );
    });

    test("unknown type throws ProteusError", () => {
      expect(() => mapFieldTypeMysql(makeField("x", { type: "unknown" as any }))).toThrow(
        ProteusError,
      );
    });
  });
});
