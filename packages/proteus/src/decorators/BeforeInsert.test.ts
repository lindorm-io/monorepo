import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { BeforeInsert } from "./BeforeInsert.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const beforeInsertCallback = vi.fn();

@Entity({ name: "BeforeInsertDecorated" })
@BeforeInsert(beforeInsertCallback)
class BeforeInsertDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("BeforeInsert", () => {
  test("should register BeforeInsert hook", () => {
    const meta = getEntityMetadata(BeforeInsertDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "BeforeInsert");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(beforeInsertCallback);
  });
});
