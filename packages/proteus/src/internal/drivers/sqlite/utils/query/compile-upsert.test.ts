import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { compileUpsert } from "./compile-upsert.js";
import { describe, expect, test } from "vitest";

// Entity-property keys differ from their DB column names — the conflict target
// must resolve to COLUMN names (pg parity), not quote the keys raw.
const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "accounts",
    namespace: null,
  },
  fields: [
    makeField("accountId", { type: "uuid", name: "account_id" }),
    makeField("userEmail", { type: "string", name: "user_email" }),
    makeField("displayName", { type: "string", name: "display_name" }),
  ],
  relations: [],
  primaryKeys: ["accountId"],
  generated: [],
} as unknown as EntityMetadata;

describe("compileUpsert (sqlite)", () => {
  test("explicit conflict columns resolve entity keys to column names", () => {
    const compiled = compileUpsert(
      { accountId: "a1", userEmail: "x@y.z", displayName: "X" },
      metadata,
      null,
      { conflictColumns: ["userEmail"] },
    );
    expect(compiled.text).toContain('ON CONFLICT ("user_email")');
    expect(compiled).toMatchSnapshot();
  });

  test("default conflict target resolves renamed primary keys to column names", () => {
    const compiled = compileUpsert(
      { accountId: "a1", userEmail: "x@y.z", displayName: "X" },
      metadata,
      null,
    );
    expect(compiled.text).toContain('ON CONFLICT ("account_id")');
    expect(compiled).toMatchSnapshot();
  });
});
