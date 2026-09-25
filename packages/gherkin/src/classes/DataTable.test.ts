import { describe, expect, test } from "vitest";
import { z } from "zod";
import { capture, captureAsync, errorShape } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import { DataTable } from "./DataTable.js";

const MATRIX: Array<Array<string>> = [
  ["name", "price"],
  ["apple", "3"],
  ["pear", "4"],
];

const ProductSchema = z.object({ name: z.string(), price: z.coerce.number() });

const AsyncSchema = z.object({
  name: z.string().refine(async () => true),
});

describe("DataTable", () => {
  describe("cucumber-js methods", () => {
    test("should return the full matrix from raw()", () => {
      expect(new DataTable(MATRIX).raw()).toEqual(MATRIX);
    });

    test("should return the body rows from rows()", () => {
      expect(new DataTable(MATRIX).rows()).toEqual([
        ["apple", "3"],
        ["pear", "4"],
      ]);
    });

    test("should return header-keyed Records from hashes()", () => {
      expect(new DataTable(MATRIX).hashes()).toEqual([
        { name: "apple", price: "3" },
        { name: "pear", price: "4" },
      ]);
    });

    test("should keep a __proto__ header cell as an OWN key in hashes()", () => {
      const [hash] = new DataTable([
        ["__proto__", "safe"],
        ["evil", "ok"],
      ]).hashes();

      // Object.fromEntries semantics — cucumber's `object[key] =` assignment
      // would set the prototype and the column would silently vanish.
      expect(Object.hasOwn(hash, "__proto__")).toBe(true);
      expect(hash["__proto__"]).toBe("evil");
      expect(hash.safe).toBe("ok");
    });

    test("should read ALL rows of a two-column table as key/value pairs in rowsHash()", () => {
      // No header semantics — cucumber-js reads every row, first included.
      expect(
        new DataTable([
          ["algorithm", "A128KW"],
          ["encryption", "A128GCM"],
        ]).rowsHash(),
      ).toEqual({ algorithm: "A128KW", encryption: "A128GCM" });
    });

    test("should keep a __proto__ key cell as an OWN key in rowsHash()", () => {
      const record = new DataTable([["__proto__", "evil"]]).rowsHash();

      expect(Object.hasOwn(record, "__proto__")).toBe(true);
      expect(record["__proto__"]).toBe("evil");
    });

    test("should throw invalid_data_table from rowsHash() on a non-two-column table, naming the row", () => {
      // cucumber-js throws here too; the shape has no key/value reading.
      const error = capture(() =>
        new DataTable([
          ["algorithm", "A128KW"],
          ["encryption", "A128GCM", "A256GCM"],
        ]).rowsHash(),
      );

      expect(error).toBeInstanceOf(GherkinError);
      expect(error.code).toBe("invalid_data_table");
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should transpose into a NEW DataTable, leaving the original untouched", () => {
      const table = new DataTable(MATRIX);
      const transposed = table.transpose();

      expect(transposed).not.toBe(table);
      expect(transposed.raw()).toEqual([
        ["name", "apple", "pear"],
        ["price", "3", "4"],
      ]);
      expect(table.raw()).toEqual(MATRIX);
    });

    test("should stay total on an empty table where cucumber-js crashes", () => {
      const empty = new DataTable([]);

      expect(empty.raw()).toEqual([]);
      expect(empty.rows()).toEqual([]);
      expect(empty.hashes()).toEqual([]);
      expect(empty.rowsHash()).toEqual({});
      expect(empty.transpose().raw()).toEqual([]);
    });
  });

  describe("duplicate keys", () => {
    test("should throw invalid_data_table from hashes() on a repeated header cell, naming the key and its columns", () => {
      const error = capture(() =>
        new DataTable([
          ["name", "name"],
          ["apple", "pear"],
        ]).hashes(),
      );

      expect(error).toBeInstanceOf(GherkinError);
      expect(error.code).toBe("invalid_data_table");
      expect(error.message).toContain('"name" appears in columns 1, 2');
      expect(error.data).toEqual({ columns: [1, 2], key: "name" });
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should name every column a thrice-repeated header cell occupies", () => {
      const error = capture(() =>
        new DataTable([
          ["algorithm", "encryption", "algorithm", "algorithm"],
          ["A128KW", "A128GCM", "A256KW", "dir"],
        ]).hashes(),
      );

      expect(error.data).toEqual({ columns: [1, 3, 4], key: "algorithm" });
    });

    test("should throw from hashes() on a repeated header cell in a table with no body rows", () => {
      const error = capture(() => new DataTable([["name", "name"]]).hashes());

      expect(error.code).toBe("invalid_data_table");
      expect(error.data).toEqual({ columns: [1, 2], key: "name" });
    });

    test("should throw invalid_data_table from rowsHash() on a repeated key, naming the key and its rows", () => {
      const error = capture(() =>
        new DataTable([
          ["algorithm", "A128KW"],
          ["algorithm", "A256KW"],
        ]).rowsHash(),
      );

      expect(error).toBeInstanceOf(GherkinError);
      expect(error.code).toBe("invalid_data_table");
      expect(error.message).toContain('"algorithm" appears in rows 1, 2');
      expect(error.data).toEqual({ key: "algorithm", rows: [1, 2] });
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should name every row a thrice-repeated rowsHash() key occupies", () => {
      const error = capture(() =>
        new DataTable([
          ["algorithm", "A128KW"],
          ["encryption", "A128GCM"],
          ["algorithm", "A256KW"],
          ["algorithm", "dir"],
        ]).rowsHash(),
      );

      expect(error.data).toEqual({ key: "algorithm", rows: [1, 3, 4] });
    });

    test("should refuse a repeated __proto__ header cell by name", () => {
      const error = capture(() =>
        new DataTable([
          ["__proto__", "__proto__"],
          ["evil", "worse"],
        ]).hashes(),
      );

      expect(error.data).toEqual({ columns: [1, 2], key: "__proto__" });
    });

    test("should refuse a repeated __proto__ rowsHash() key by name", () => {
      const error = capture(() =>
        new DataTable([
          ["__proto__", "evil"],
          ["__proto__", "worse"],
        ]).rowsHash(),
      );

      expect(error.data).toEqual({ key: "__proto__", rows: [1, 2] });
    });

    test("should accept repeated VALUES — only keys carry the uniqueness rule", () => {
      expect(
        new DataTable([
          ["name", "price"],
          ["apple", "apple"],
        ]).hashes(),
      ).toEqual([{ name: "apple", price: "apple" }]);

      expect(
        new DataTable([
          ["algorithm", "dir"],
          ["encryption", "dir"],
        ]).rowsHash(),
      ).toEqual({ algorithm: "dir", encryption: "dir" });
    });

    test("should refuse a repeated header cell from create() before schema conversion", () => {
      const error = capture(() =>
        new DataTable([
          ["name", "name"],
          ["apple", "pear"],
        ]).create(ProductSchema),
      );

      expect(error.code).toBe("invalid_data_table");
      expect(error.data).toEqual({ columns: [1, 2], key: "name" });
    });
  });

  describe("defensive copying", () => {
    test("should not corrupt the instance when a consumer mutates raw()", () => {
      // The deliberate divergence from cucumber's shallow slice(0), where
      // this mutation poisons every later hashes()/rows() call.
      const table = new DataTable(MATRIX);

      table.raw()[1][1] = "corrupted";
      table.raw().push(["injected", "row"]);

      expect(table.hashes()).toEqual([
        { name: "apple", price: "3" },
        { name: "pear", price: "4" },
      ]);
    });

    test("should not observe later mutation of the constructor input", () => {
      const input = MATRIX.map((row) => [...row]);
      const table = new DataTable(input);

      input[1][1] = "corrupted";

      expect(table.raw()).toEqual(MATRIX);
    });
  });

  describe("zod conversion", () => {
    test("should create ONE typed object from a single-body-row table", () => {
      const product = new DataTable([
        ["name", "price"],
        ["fig", "5"],
      ]).create(ProductSchema);

      expect(product).toEqual({ name: "fig", price: 5 });
    });

    test("should throw invalid_data_table from create() on a multi-row table — never silent truncation", () => {
      const error = capture(() => new DataTable(MATRIX).create(ProductSchema));

      expect(error.code).toBe("invalid_data_table");
      expect(error.data).toEqual({ bodyRows: 2 });
      expect(errorShape(error)).toMatchSnapshot();
    });

    test("should throw invalid_data_table from create() on a table with no body rows", () => {
      const error = capture(() =>
        new DataTable([["name", "price"]]).create(ProductSchema),
      );

      expect(error.code).toBe("invalid_data_table");
      expect(error.data).toEqual({ bodyRows: 0 });
    });

    test("should createSet a typed array from every body row", () => {
      expect(new DataTable(MATRIX).createSet(ProductSchema)).toEqual([
        { name: "apple", price: 3 },
        { name: "pear", price: 4 },
      ]);
    });

    test("should wrap a ZodError as table_conversion_failed, naming the body row", () => {
      const error = capture(() =>
        new DataTable([
          ["name", "price"],
          ["apple", "3"],
          ["pear", "oops"],
        ]).createSet(ProductSchema),
      );

      expect(error).toBeInstanceOf(GherkinError);
      expect(error.code).toBe("table_conversion_failed");
      expect(error.type).toBe("urn:lindorm:gherkin:error:table_conversion_failed");
      expect(error.message).toContain("Data table body row 2 failed schema conversion");
      // zod's issue details stay visible in the message.
      expect(error.message).toContain("Invalid input: expected number, received NaN");
      expect(error.data).toMatchObject({ row: 2 });
    });

    test("should wrap a create() ZodError as table_conversion_failed", () => {
      const error = capture(() =>
        new DataTable([
          ["name", "price"],
          ["fig", "oops"],
        ]).create(ProductSchema),
      );

      expect(error.code).toBe("table_conversion_failed");
      expect(error.message).toContain("Data table body row 1 failed schema conversion");
    });

    test("should pass zod's sync-parse-of-async error through VERBATIM from create()", () => {
      // The locked §3.6 mechanism: the message naming its own fix must
      // survive untouched — wrapping or swallowing it would hide the fix.
      const error = capture(() =>
        new DataTable([["name"], ["x"]]).create(AsyncSchema),
      ) as unknown as Error;

      expect(error).not.toBeInstanceOf(GherkinError);
      expect(error.message).toBe(
        "Encountered Promise during synchronous parse. Use .parseAsync() instead.",
      );
    });

    test("should pass zod's sync-parse-of-async error through VERBATIM from createSet()", () => {
      const error = capture(() =>
        new DataTable([["name"], ["x"]]).createSet(AsyncSchema),
      ) as unknown as Error;

      expect(error.message).toBe(
        "Encountered Promise during synchronous parse. Use .parseAsync() instead.",
      );
    });

    test("should rethrow a consumer refinement's own error untouched", () => {
      const own = new Error("domain rule broken");
      const throwing = z.object({ name: z.string() }).transform(() => {
        throw own;
      });

      const error = capture(() =>
        new DataTable([["name"], ["x"]]).create(throwing),
      ) as unknown as Error;

      // Identity preserved — assertion diffs and stacks survive.
      expect(error).toBe(own);
    });
  });

  describe("async zod conversion", () => {
    test("should createAsync ONE typed object through parseAsync", async () => {
      await expect(
        new DataTable([["name"], ["fig"]]).createAsync(AsyncSchema),
      ).resolves.toEqual({ name: "fig" });
    });

    test("should createSetAsync every body row in table order", async () => {
      await expect(new DataTable(MATRIX).createSetAsync(ProductSchema)).resolves.toEqual([
        { name: "apple", price: 3 },
        { name: "pear", price: 4 },
      ]);
    });

    test("should wrap an async ZodError as table_conversion_failed, naming the body row", async () => {
      const error = await captureAsync(() =>
        new DataTable([
          ["name", "price"],
          ["apple", "oops"],
        ]).createSetAsync(ProductSchema),
      );

      expect(error.code).toBe("table_conversion_failed");
      expect(error.message).toContain("Data table body row 1 failed schema conversion");
      expect(error.message).toContain("Invalid input: expected number, received NaN");
    });

    test("should wrap a createAsync ZodError as table_conversion_failed", async () => {
      const error = await captureAsync(() =>
        new DataTable([
          ["name", "price"],
          ["fig", "oops"],
        ]).createAsync(ProductSchema),
      );

      expect(error.code).toBe("table_conversion_failed");
    });

    test("should reject with a rejecting refinement's own error untouched", async () => {
      const own = new Error("async domain rule broken");
      const rejecting = z.object({ name: z.string() }).refine(async () => {
        throw own;
      });

      const error = (await captureAsync(() =>
        new DataTable([["name"], ["x"]]).createAsync(rejecting),
      )) as unknown as Error;

      expect(error).toBe(own);
    });
  });
});
