import { Entity } from "../../../../../decorators/Entity.js";
import { Field } from "../../../../../decorators/Field.js";
import { Generated } from "../../../../../decorators/Generated.js";
import { PrimaryKeyField } from "../../../../../decorators/PrimaryKeyField.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { generateColumnDDL } from "./generate-column-ddl.js";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Test entities — must be at module scope for stage-3 decorator execution.
// ---------------------------------------------------------------------------

/** lindorm_id generated field — SQLite has no VARCHAR(n), so it maps to TEXT */
@Entity({ name: "LiteColLindormId" })
class LiteColLindormId {
  @PrimaryKeyField()
  id!: string;

  @Field("varchar")
  @Generated("lindorm_id")
  token!: string;
}

describe("generateColumnDDL (SQLite)", () => {
  test("lindorm_id field emits TEXT with no DEFAULT", () => {
    const meta = getEntityMetadata(LiteColLindormId);
    const cols = generateColumnDDL(meta, "lite_col_lindorm_id");
    const tokenCol = cols.find((c) => c.includes('"token"'));
    expect(tokenCol).toContain("TEXT");
    expect(tokenCol).not.toContain("DEFAULT");
    expect(cols).toMatchSnapshot();
  });
});
