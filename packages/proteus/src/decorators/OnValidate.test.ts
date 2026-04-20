import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { OnValidate } from "./OnValidate";
import { PrimaryKeyField } from "./PrimaryKeyField";
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
