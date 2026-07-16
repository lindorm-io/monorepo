import { describe, expect, test } from "vitest";
import { ProteusError } from "../../../../errors/index.js";
import type { EntityMetadata, MetaField } from "../../../entity/types/metadata.js";
import { mapFieldTypeSqlite } from "./map-field-type-sqlite.js";
import { resolveFkColumnType } from "./resolve-fk-column-type.js";

const metaWithPk = (type: string): { meta: EntityMetadata; field: MetaField } => {
  const field = { key: "id", type } as unknown as MetaField;
  const meta = {
    entity: { name: "SqliteFkRef" },
    fields: [field],
  } as unknown as EntityMetadata;
  return { meta, field };
};

describe("resolveFkColumnType (sqlite)", () => {
  test("FK column type equals the PK column mapper for every field type", () => {
    // Self-verifying: the FK type is derived through the SAME mapper the PK column
    // uses, so they agree by construction — the bespoke INTEGER/TEXT switch did not.
    for (const type of [
      "uuid",
      "string",
      "integer",
      "bigint",
      "decimal",
      "binary",
      "real",
      "boolean",
    ]) {
      const { meta, field } = metaWithPk(type);
      expect(resolveFkColumnType(meta, "id")).toBe(mapFieldTypeSqlite(field));
    }
  });

  test("a decimal / binary PK no longer collapses to the old TEXT default", () => {
    expect(resolveFkColumnType(metaWithPk("decimal").meta, "id")).not.toBe("TEXT");
    expect(resolveFkColumnType(metaWithPk("binary").meta, "id")).not.toBe("TEXT");
  });

  test("throws when the referenced PK field does not exist", () => {
    expect(() => resolveFkColumnType(metaWithPk("uuid").meta, "missing")).toThrow(
      ProteusError,
    );
  });
});
