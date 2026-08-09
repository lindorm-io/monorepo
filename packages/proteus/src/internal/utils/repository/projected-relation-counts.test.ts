import { describe, expect, test } from "vitest";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { projectedRelationCounts } from "./projected-relation-counts.js";

const metadata = {
  relationCounts: [
    { key: "postCount", relationKey: "posts" },
    { key: "tagCount", relationKey: "tags" },
  ],
} as unknown as EntityMetadata;

describe("projectedRelationCounts", () => {
  test("returns every relationCount when there is no projection", () => {
    expect(projectedRelationCounts(metadata, null).map((rc) => rc.key)).toEqual([
      "postCount",
      "tagCount",
    ]);
  });

  test("returns only the relationCounts the projection names", () => {
    expect(
      projectedRelationCounts(metadata, ["id", "tagCount"]).map((rc) => rc.key),
    ).toEqual(["tagCount"]);
  });

  test("returns none when the projection names no relationCount", () => {
    expect(projectedRelationCounts(metadata, ["id"])).toEqual([]);
  });

  test("returns none for an empty projection", () => {
    expect(projectedRelationCounts(metadata, [])).toEqual([]);
  });

  test("tolerates metadata without relationCounts", () => {
    expect(projectedRelationCounts({} as EntityMetadata, null)).toEqual([]);
  });
});
