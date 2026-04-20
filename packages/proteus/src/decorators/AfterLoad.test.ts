import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { AfterLoad } from "./AfterLoad";
import { Entity } from "./Entity";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { describe, expect, test, vi } from "vitest";

const afterLoadCallback = vi.fn();

@Entity({ name: "AfterLoadDecorated" })
@AfterLoad(afterLoadCallback)
class AfterLoadDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("AfterLoad", () => {
  test("should register AfterLoad hook", () => {
    const meta = getEntityMetadata(AfterLoadDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "AfterLoad");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(afterLoadCallback);
  });
});
