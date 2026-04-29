import { collectAll, collectOwn, collectSingular } from "./collect.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { Namespace } from "../../../decorators/Namespace.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { VersionField } from "../../../decorators/VersionField.js";
import { describe, expect, test } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture classes must be defined at module scope (stage 3 decorators)
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "CollectOwnTest" })
class CollectOwnTest {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "CollectOwnMinimal" })
class CollectOwnMinimal {
  @PrimaryKeyField()
  id!: string;
}

class PlainClass {}

@Entity({ name: "CollectAllOwn" })
class CollectAllOwn {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "CollectAllParent" })
class CollectAllParent {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "CollectAllChild" })
class CollectAllChild extends CollectAllParent {
  @Field("string")
  name!: string;
}

class PlainCollectAll {}

@Namespace("test")
@Entity({ name: "CollectSingularEntity" })
class CollectSingularEntity {
  @PrimaryKeyField()
  id!: string;
}

class PlainCollectSingular {}

@Entity({ name: "CollectSingularParentInherit" })
class CollectSingularParentInherit {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;
}

@Entity({ name: "CollectSingularChildInherit" })
class CollectSingularChildInherit extends CollectSingularParentInherit {
  @Field("string")
  extra!: string;
}

// Three-level inheritance chain
@Entity({ name: "CollectGrandparent" })
class CollectGrandparent {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  gpField!: string;
}

@Entity({ name: "CollectMiddle" })
class CollectMiddle extends CollectGrandparent {
  @Field("string")
  midField!: string;
}

@Entity({ name: "CollectGrandchild" })
class CollectGrandchild extends CollectMiddle {
  @Field("integer")
  gcField!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("collectOwn", () => {
  test("should collect own fields from decorated class", () => {
    const result = collectOwn(CollectOwnTest, "fields");
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
  });

  test("should return undefined for non-decorated class", () => {
    expect(collectOwn(PlainClass, "fields")).toBeUndefined();
  });

  test("should return undefined when key not present in own metadata", () => {
    // checks is not staged on this minimal entity
    expect(collectOwn(CollectOwnMinimal, "checks")).toBeUndefined();
  });
});

describe("collectAll", () => {
  test("should collect own fields", () => {
    const result = collectAll(CollectAllOwn, "fields");
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((f) => f.key === "id")).toBe(true);
    expect(result.some((f) => f.key === "name")).toBe(true);
  });

  test("should collect inherited fields from parent", () => {
    const result = collectAll(CollectAllChild, "fields");
    expect(result.some((f) => f.key === "id")).toBe(true);
    expect(result.some((f) => f.key === "name")).toBe(true);
  });

  test("should return empty array for non-decorated class", () => {
    expect(collectAll(PlainCollectAll, "fields")).toEqual([]);
  });

  test("should collect fields from three-level inheritance chain", () => {
    const result = collectAll(CollectGrandchild, "fields");
    const keys = result.map((f) => f.key);

    expect(keys).toContain("id");
    expect(keys).toContain("gpField");
    expect(keys).toContain("midField");
    expect(keys).toContain("gcField");
  });

  test("should not duplicate fields across three levels", () => {
    const result = collectAll(CollectGrandchild, "fields");
    const keys = result.map((f) => f.key);

    // Each field appears exactly once
    const uniqueKeys = [...new Set(keys)];
    expect(keys.length).toBe(uniqueKeys.length);
  });

  test("should not include child fields in parent", () => {
    const result = collectAll(CollectGrandparent, "fields");
    const keys = result.map((f) => f.key);

    expect(keys).toContain("id");
    expect(keys).toContain("gpField");
    expect(keys).not.toContain("midField");
    expect(keys).not.toContain("gcField");
  });
});

describe("collectSingular", () => {
  test("should collect entity metadata", () => {
    const entity = collectSingular(CollectSingularEntity, "entity");
    expect(entity).toBeDefined();
    expect(entity!.name).toBe("CollectSingularEntity");
  });

  test("should collect namespace metadata", () => {
    const namespace = collectSingular(CollectSingularEntity, "namespace");
    expect(namespace).toBe("test");
  });

  test("should return undefined for non-decorated class", () => {
    expect(collectSingular(PlainCollectSingular, "entity")).toBeUndefined();
  });

  test("should return child entity metadata (not parent)", () => {
    const entity = collectSingular(CollectSingularChildInherit, "entity");
    expect(entity).toBeDefined();
    expect(entity!.name).toBe("CollectSingularChildInherit");
  });
});
