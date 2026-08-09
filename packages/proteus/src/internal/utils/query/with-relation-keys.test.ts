import { describe, expect, test } from "vitest";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { IncludeSpec } from "../../types/query.js";
import { withRelationKeys } from "./with-relation-keys.js";

const metadata = { primaryKeys: ["id"] } as unknown as EntityMetadata;
const composite = { primaryKeys: ["tenantId", "id"] } as unknown as EntityMetadata;

const include: IncludeSpec = {
  relation: "posts",
  required: false,
  strategy: "join",
  select: null,
  where: null,
};

describe("withRelationKeys", () => {
  test("adds the primary key to a projection that asks for relations", () => {
    expect(withRelationKeys(["name"], [include], metadata)).toEqual(["name", "id"]);
  });

  test("adds every part of a composite primary key", () => {
    expect(withRelationKeys(["name"], [include], composite)).toEqual([
      "name",
      "tenantId",
      "id",
    ]);
  });

  test("does not repeat a primary key the caller already named", () => {
    expect(withRelationKeys(["id", "name"], [include], metadata)).toEqual(["id", "name"]);
  });

  // A GROUP BY projection must name what it groups by and nothing else.
  test("leaves a projection with no relations exactly as written", () => {
    expect(withRelationKeys(["name"], [], metadata)).toEqual(["name"]);
  });

  test("leaves a full projection alone", () => {
    expect(withRelationKeys(null, [include], metadata)).toBeNull();
  });
});
