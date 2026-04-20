import { AbstractEntity } from "../../../decorators/AbstractEntity";
import { Discriminator } from "../../../decorators/Discriminator";
import { DiscriminatorValue } from "../../../decorators/DiscriminatorValue";
import { Entity } from "../../../decorators/Entity";
import { Field } from "../../../decorators/Field";
import { Inheritance } from "../../../decorators/Inheritance";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { resolveInheritanceHierarchies } from "./resolve-inheritance";
import { beforeAll, describe, expect, test } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Single-table: two concrete subtypes
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "RIVehicle" })
@Discriminator("type")
@Inheritance("single-table")
class RIVehicle {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;
}

@Entity({ name: "RICar" })
@DiscriminatorValue("car")
class RICar extends RIVehicle {}

@Entity({ name: "RITruck" })
@DiscriminatorValue("truck")
class RITruck extends RIVehicle {}

// ─────────────────────────────────────────────────────────────────────────────
// Single-table: numeric discriminator values
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "RINumericRoot" })
@Discriminator("kind")
@Inheritance("single-table")
class RINumericRoot {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  kind!: number;
}

@Entity({ name: "RINumericTypeOne" })
@DiscriminatorValue(1)
class RINumericTypeOne extends RINumericRoot {}

@Entity({ name: "RINumericTypeTwo" })
@DiscriminatorValue(2)
class RINumericTypeTwo extends RINumericRoot {}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-level single-table: A → B → C
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "RILevelA" })
@Discriminator("type")
@Inheritance("single-table")
class RILevelA {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;
}

@Entity({ name: "RILevelB" })
@DiscriminatorValue("b")
class RILevelB extends RILevelA {}

@Entity({ name: "RILevelC" })
@DiscriminatorValue("c")
class RILevelC extends RILevelB {}

// ─────────────────────────────────────────────────────────────────────────────
// Single-table with an abstract intermediate subtype
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "RIAbstractRoot" })
@Discriminator("type")
@Inheritance("single-table")
class RIAbstractRoot {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;
}

@AbstractEntity()
class RIAbstractMiddle extends RIAbstractRoot {}

@Entity({ name: "RIConcreteLeaf" })
@DiscriminatorValue("leaf")
class RIConcreteLeaf extends RIAbstractMiddle {}

// ─────────────────────────────────────────────────────────────────────────────
// Joined strategy: direct subtypes
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "RIJoinedRoot" })
@Discriminator("type")
@Inheritance("joined")
class RIJoinedRoot {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;
}

@Entity({ name: "RIJoinedChildA" })
@DiscriminatorValue("joined-a")
class RIJoinedChildA extends RIJoinedRoot {}

@Entity({ name: "RIJoinedChildB" })
@DiscriminatorValue("joined-b")
class RIJoinedChildB extends RIJoinedRoot {}

// ─────────────────────────────────────────────────────────────────────────────
// Invalid: joined depth > 1
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "RIJoinedDepthRoot" })
@Discriminator("type")
@Inheritance("joined")
class RIJoinedDepthRoot {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;
}

@Entity({ name: "RIJoinedDepthIntermediate" })
@DiscriminatorValue("intermediate")
class RIJoinedDepthIntermediate extends RIJoinedDepthRoot {}

@Entity({ name: "RIJoinedDepthLeaf" })
@DiscriminatorValue("leaf")
class RIJoinedDepthLeaf extends RIJoinedDepthIntermediate {}

// ─────────────────────────────────────────────────────────────────────────────
// Invalid: duplicate discriminator values
// ─────────────────────────────────────────────────────────────────────────────

@Entity({ name: "RIDuplicateRoot" })
@Discriminator("type")
@Inheritance("single-table")
class RIDuplicateRoot {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;
}

@Entity({ name: "RIDuplicateChildA" })
@DiscriminatorValue("duplicate")
class RIDuplicateChildA extends RIDuplicateRoot {}

@Entity({ name: "RIDuplicateChildB" })
@DiscriminatorValue("duplicate")
class RIDuplicateChildB extends RIDuplicateRoot {}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveInheritanceHierarchies", () => {
  describe("single-table with two concrete subtypes", () => {
    const entities = [RIVehicle, RICar, RITruck] as any[];
    let result: ReturnType<typeof resolveInheritanceHierarchies>;

    beforeAll(() => {
      result = resolveInheritanceHierarchies(entities);
    });

    test("should produce entries for the root and both children", () => {
      expect(result.size).toBe(3);
      expect(result.has(RIVehicle)).toBe(true);
      expect(result.has(RICar)).toBe(true);
      expect(result.has(RITruck)).toBe(true);
    });

    test("root should have null discriminatorValue and null parent", () => {
      const rootMeta = result.get(RIVehicle)!;
      expect(rootMeta.discriminatorValue).toBeNull();
      expect(rootMeta.parent).toBeNull();
    });

    test("root should reference itself as root", () => {
      const rootMeta = result.get(RIVehicle)!;
      expect(rootMeta.root).toBe(RIVehicle);
    });

    test("root should have correct strategy and discriminatorField", () => {
      const rootMeta = result.get(RIVehicle)!;
      expect(rootMeta.strategy).toBe("single-table");
      expect(rootMeta.discriminatorField).toBe("type");
    });

    test("root children map should contain both subtypes", () => {
      const rootMeta = result.get(RIVehicle)!;
      expect(rootMeta.children.get("car")).toBe(RICar);
      expect(rootMeta.children.get("truck")).toBe(RITruck);
    });

    test("car child should have correct discriminatorValue and parent", () => {
      const carMeta = result.get(RICar)!;
      expect(carMeta.discriminatorValue).toBe("car");
      expect(carMeta.parent).toBe(RIVehicle);
      expect(carMeta.root).toBe(RIVehicle);
    });

    test("truck child should have correct discriminatorValue and parent", () => {
      const truckMeta = result.get(RITruck)!;
      expect(truckMeta.discriminatorValue).toBe("truck");
      expect(truckMeta.parent).toBe(RIVehicle);
      expect(truckMeta.root).toBe(RIVehicle);
    });

    test("children share the same Map reference across root and children", () => {
      const rootMeta = result.get(RIVehicle)!;
      const carMeta = result.get(RICar)!;
      const truckMeta = result.get(RITruck)!;

      expect(carMeta.children).toBe(rootMeta.children);
      expect(truckMeta.children).toBe(rootMeta.children);
    });

    test("strategy is propagated from root to children", () => {
      const carMeta = result.get(RICar)!;
      const truckMeta = result.get(RITruck)!;

      expect(carMeta.strategy).toBe("single-table");
      expect(truckMeta.strategy).toBe("single-table");
    });

    test("MetaInheritance for root and children matches snapshot", () => {
      // Snapshot the serialisable parts of the map (skip Map/Function refs)
      const snapshot = Array.from(result.entries()).map(([ctor, meta]) => ({
        name: ctor.name,
        strategy: meta.strategy,
        discriminatorField: meta.discriminatorField,
        discriminatorValue: meta.discriminatorValue,
        rootName: meta.root.name,
        parentName: meta.parent?.name ?? null,
        childrenKeys: Array.from(meta.children.keys()),
      }));
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe("single-table with numeric discriminator values", () => {
    test("should resolve numeric discriminator values correctly", () => {
      const result = resolveInheritanceHierarchies([
        RINumericRoot,
        RINumericTypeOne,
        RINumericTypeTwo,
      ] as any[]);

      const rootMeta = result.get(RINumericRoot)!;
      expect(rootMeta.children.get(1)).toBe(RINumericTypeOne);
      expect(rootMeta.children.get(2)).toBe(RINumericTypeTwo);
    });
  });

  describe("multi-level single-table: A → B → C", () => {
    let result: ReturnType<typeof resolveInheritanceHierarchies>;

    beforeAll(() => {
      result = resolveInheritanceHierarchies([RILevelA, RILevelB, RILevelC] as any[]);
    });

    test("should produce entries for A, B, and C", () => {
      expect(result.size).toBe(3);
    });

    test("A (root) should have null parent and null discriminatorValue", () => {
      const aMeta = result.get(RILevelA)!;
      expect(aMeta.parent).toBeNull();
      expect(aMeta.discriminatorValue).toBeNull();
    });

    test("B should have A as parent", () => {
      const bMeta = result.get(RILevelB)!;
      expect(bMeta.parent).toBe(RILevelA);
      expect(bMeta.discriminatorValue).toBe("b");
    });

    test("C should have B as its direct parent", () => {
      const cMeta = result.get(RILevelC)!;
      expect(cMeta.parent).toBe(RILevelB);
      expect(cMeta.discriminatorValue).toBe("c");
    });

    test("C's root should be A", () => {
      const cMeta = result.get(RILevelC)!;
      expect(cMeta.root).toBe(RILevelA);
    });

    test("children map includes both B and C", () => {
      const aMeta = result.get(RILevelA)!;
      expect(aMeta.children.get("b")).toBe(RILevelB);
      expect(aMeta.children.get("c")).toBe(RILevelC);
    });
  });

  describe("single-table with abstract intermediate", () => {
    test("should include concrete leaf but not require discriminator value on abstract", () => {
      const result = resolveInheritanceHierarchies([
        RIAbstractRoot,
        RIAbstractMiddle,
        RIConcreteLeaf,
      ] as any[]);

      expect(result.has(RIAbstractRoot)).toBe(true);
      expect(result.has(RIConcreteLeaf)).toBe(true);

      // Abstract intermediate participates in hierarchy but has no discriminator value
      const middleMeta = result.get(RIAbstractMiddle)!;
      expect(middleMeta).toBeDefined();
      expect(middleMeta.discriminatorValue).toBeNull();

      // Leaf has correct discriminator value
      const leafMeta = result.get(RIConcreteLeaf)!;
      expect(leafMeta.discriminatorValue).toBe("leaf");
    });
  });

  describe("joined strategy with direct subtypes", () => {
    let result: ReturnType<typeof resolveInheritanceHierarchies>;

    beforeAll(() => {
      result = resolveInheritanceHierarchies([
        RIJoinedRoot,
        RIJoinedChildA,
        RIJoinedChildB,
      ] as any[]);
    });

    test("should produce entries for root and both joined children", () => {
      expect(result.size).toBe(3);
    });

    test("root should have 'joined' strategy", () => {
      const rootMeta = result.get(RIJoinedRoot)!;
      expect(rootMeta.strategy).toBe("joined");
    });

    test("children should have 'joined' strategy propagated from root", () => {
      expect(result.get(RIJoinedChildA)!.strategy).toBe("joined");
      expect(result.get(RIJoinedChildB)!.strategy).toBe("joined");
    });

    test("children should have correct discriminator values", () => {
      expect(result.get(RIJoinedChildA)!.discriminatorValue).toBe("joined-a");
      expect(result.get(RIJoinedChildB)!.discriminatorValue).toBe("joined-b");
    });

    test("children should reference the joined root as parent", () => {
      expect(result.get(RIJoinedChildA)!.parent).toBe(RIJoinedRoot);
      expect(result.get(RIJoinedChildB)!.parent).toBe(RIJoinedRoot);
    });
  });

  describe("validation: joined strategy depth > 1", () => {
    test("should throw when a joined hierarchy has depth > 1", () => {
      expect(() =>
        resolveInheritanceHierarchies([
          RIJoinedDepthRoot,
          RIJoinedDepthIntermediate,
          RIJoinedDepthLeaf,
        ] as any[]),
      ).toThrow("does not support multi-level depth");
    });
  });

  describe("validation: duplicate discriminator values", () => {
    test("should throw on duplicate discriminator value within same hierarchy", () => {
      expect(() =>
        resolveInheritanceHierarchies([
          RIDuplicateRoot,
          RIDuplicateChildA,
          RIDuplicateChildB,
        ] as any[]),
      ).toThrow('Discriminator value "duplicate" is already used by entity');
    });
  });

  describe("validation: @Discriminator without @Inheritance", () => {
    test("should throw when @Discriminator exists on a class without @Inheritance", () => {
      @Entity({ name: "RIInvalidDiscriminator" })
      @Discriminator("type")
      class RIInvalidDiscriminator {
        @PrimaryKeyField()
        id!: string;
        type!: string;
      }

      expect(() =>
        resolveInheritanceHierarchies([RIInvalidDiscriminator] as any[]),
      ).toThrow("@Discriminator requires @Inheritance");
    });
  });

  describe("validation: @DiscriminatorValue without @Inheritance in chain", () => {
    test("should throw when @DiscriminatorValue exists without any @Inheritance in chain", () => {
      @Entity({ name: "RIOrphanValue" })
      @DiscriminatorValue("orphan")
      class RIOrphanValue {
        @PrimaryKeyField()
        id!: string;
      }

      expect(() => resolveInheritanceHierarchies([RIOrphanValue] as any[])).toThrow(
        "@DiscriminatorValue on",
      );
    });
  });

  describe("empty and non-participating entities", () => {
    test("should return empty map when no entities participate in inheritance", () => {
      @Entity({ name: "RIPlain" })
      class RIPlain {
        @PrimaryKeyField()
        id!: string;
      }

      const result = resolveInheritanceHierarchies([RIPlain] as any[]);
      expect(result.size).toBe(0);
    });

    test("should return empty map for empty input", () => {
      const result = resolveInheritanceHierarchies([]);
      expect(result.size).toBe(0);
    });
  });
});
