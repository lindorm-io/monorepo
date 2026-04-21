import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { OnValidate } from "./OnValidate.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const onValidateCallback = vi.fn();

@Entity({ name: "OnValidateDecorated" })
@OnValidate(onValidateCallback)
class OnValidateDecorated {
  @PrimaryKeyField()
  id!: string;
}

describe("OnValidate", () => {
  test("should register OnValidate hook", () => {
    const meta = getEntityMetadata(OnValidateDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "OnValidate");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(onValidateCallback);
  });
});
