import { describe, expect, test } from "vitest";
import { SyncError } from "../../../errors/SyncError.js";
import type { DesiredTableModel } from "./desired-schema-model.js";
import type { SyncDialect } from "./sync-dialect.js";
import { hasProjectedTable } from "./has-projected-table.js";

const table = (name: string, namespace: string | null): DesiredTableModel =>
  ({ name, namespace }) as DesiredTableModel;

const dialect = (supportsNamespaces: boolean): SyncDialect =>
  ({ supportsNamespaces }) as SyncDialect;

describe("hasProjectedTable", () => {
  describe("namespace dialect (postgres)", () => {
    const pg = dialect(true);

    test("dedupes by (namespace, name)", () => {
      const tables = [table("membership", "sales")];
      expect(hasProjectedTable(tables, "membership", "sales", pg)).toBe(true);
    });

    test("keeps same-named tables in different namespaces as distinct", () => {
      const tables = [table("membership", "sales")];
      expect(hasProjectedTable(tables, "membership", "hr", pg)).toBe(false);
    });
  });

  describe("namespace-less dialect (mysql/sqlite)", () => {
    const sqlite = dialect(false);

    test("skips a same-namespace duplicate (the both-M2M-sides case)", () => {
      const tables = [table("membership", null)];
      expect(hasProjectedTable(tables, "membership", null, sqlite)).toBe(true);
    });

    test("returns false when the name is not yet projected", () => {
      expect(hasProjectedTable([], "membership", "sales", sqlite)).toBe(false);
    });

    test("throws on a same name from a different namespace (collision it cannot represent)", () => {
      const tables = [table("membership", "sales")];
      expect(() => hasProjectedTable(tables, "membership", "hr", sqlite)).toThrowError(
        expect.objectContaining({ code: "table_name_collision" }),
      );
      expect(() => hasProjectedTable(tables, "membership", "hr", sqlite)).toThrow(
        SyncError,
      );
    });
  });
});
