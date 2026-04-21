import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { OnHydrate } from "./OnHydrate.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test, vi } from "vitest";

const onHydrateCallback = vi.fn();

@Entity({ name: "OnHydrateDecorated" })
@OnHydrate(onHydrateCallback)
class OnHydrateDecorated {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "OnHydrateMultiple" })
@OnHydrate(onHydrateCallback)
@OnHydrate(onHydrateCallback)
class OnHydrateMultiple {
  @PrimaryKeyField()
  id!: string;
}

describe("OnHydrate", () => {
  test("should register OnHydrate hook", () => {
    const meta = getEntityMetadata(OnHydrateDecorated);
    const hooks = meta.hooks.filter((h) => h.decorator === "OnHydrate");
    expect(hooks).toHaveLength(1);
    expect(hooks[0].callback).toBe(onHydrateCallback);
  });

  test("should register multiple OnHydrate hooks", () => {
    const meta = getEntityMetadata(OnHydrateMultiple);
    const hooks = meta.hooks.filter((h) => h.decorator === "OnHydrate");
    expect(hooks).toHaveLength(2);
  });

  test("should match snapshot", () => {
    expect(getEntityMetadata(OnHydrateDecorated)).toMatchSnapshot();
  });
});
