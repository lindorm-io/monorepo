import { describe, expect, test } from "vitest";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { projectedRelationIds } from "./projected-relation-ids.js";

const metadata = {
  relationIds: [
    { key: "authorId", relationKey: "author", column: null },
    { key: "commentIds", relationKey: "comments", column: null },
  ],
} as unknown as EntityMetadata;

describe("projectedRelationIds", () => {
  test("returns every relationId when there is no projection", () => {
    expect(projectedRelationIds(metadata, null).map((ri) => ri.key)).toEqual([
      "authorId",
      "commentIds",
    ]);
  });

  test("returns only the relationIds the projection names", () => {
    expect(
      projectedRelationIds(metadata, ["id", "commentIds"]).map((ri) => ri.key),
    ).toEqual(["commentIds"]);
  });

  test("returns none when the projection names no relationId", () => {
    expect(projectedRelationIds(metadata, ["id"])).toEqual([]);
  });

  test("returns none for an empty projection", () => {
    expect(projectedRelationIds(metadata, [])).toEqual([]);
  });

  test("tolerates metadata without relationIds", () => {
    expect(projectedRelationIds({} as EntityMetadata, null)).toEqual([]);
  });
});
