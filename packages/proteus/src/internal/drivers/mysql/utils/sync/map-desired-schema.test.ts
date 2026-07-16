import { describe, expect, test } from "vitest";
import type {
  DesiredSchemaModel,
  DesiredTableModel,
} from "../../../../utils/sync/desired-schema-model.js";
import { MySqlSyncError } from "../../errors/MySqlSyncError.js";
import { mapDesiredSchema } from "./map-desired-schema.js";

const schemaWithFk = (deferrable: boolean): DesiredSchemaModel =>
  ({
    tables: [
      {
        name: "child",
        namespace: null,
        columns: [],
        primaryKey: { columns: [] },
        foreignKeys: [
          {
            kind: "join_table",
            name: "fk_child_parent",
            columns: ["parent_id"],
            foreignNamespace: null,
            foreignTable: "parent",
            foreignColumns: ["id"],
            onDelete: "NO ACTION",
            onUpdate: "NO ACTION",
            deferrable,
            initiallyDeferred: deferrable,
          },
        ],
        uniques: [],
        checks: [],
        indexes: [],
        comment: null,
        columnComments: {},
        triggers: [],
      } as unknown as DesiredTableModel,
    ],
  }) as unknown as DesiredSchemaModel;

describe("mapDesiredSchema (mysql)", () => {
  test("maps a non-deferrable foreign key", () => {
    const schema = mapDesiredSchema(schemaWithFk(false));
    expect(schema.tables[0].foreignKeys[0].constraintName).toBe("fk_child_parent");
  });

  test("throws on a deferrable foreign key (InnoDB has no deferred constraints)", () => {
    expect(() => mapDesiredSchema(schemaWithFk(true))).toThrowError(
      expect.objectContaining({ code: "unsupported_operation" }),
    );
    expect(() => mapDesiredSchema(schemaWithFk(true))).toThrow(MySqlSyncError);
  });
});
