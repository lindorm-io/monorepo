import { findEntityMetadata } from "./find-entity-metadata";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { describe, expect, test } from "vitest";

@Entity({ name: "FindMetadataTarget" })
class FindMetadataTarget {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

describe("findEntityMetadata", () => {
  test("should find entity by registered name", () => {
    const meta = findEntityMetadata("FindMetadataTarget");
    expect(meta).toBeDefined();
    expect(meta!.target).toBe(FindMetadataTarget);
  });

  test("should return undefined for unknown entity name", () => {
    expect(findEntityMetadata("CompletelyUnknownEntity12345")).toBeUndefined();
  });

  test("should return full metadata when found", () => {
    const meta = findEntityMetadata("FindMetadataTarget");
    expect(meta!.entity.name).toBe("FindMetadataTarget");
    expect(meta!.fields.some((f) => f.key === "name")).toBe(true);
  });
});
