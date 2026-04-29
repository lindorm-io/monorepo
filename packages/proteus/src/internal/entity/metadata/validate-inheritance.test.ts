import { describe, expect, test } from "vitest";
import { AbstractEntity } from "../../../decorators/AbstractEntity.js";
import { Discriminator } from "../../../decorators/Discriminator.js";
import { DiscriminatorValue } from "../../../decorators/DiscriminatorValue.js";
import { Entity } from "../../../decorators/Entity.js";
import { Inheritance } from "../../../decorators/Inheritance.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { Field } from "../../../decorators/Field.js";
import {
  validateDiscriminatorRequiresInheritance,
  validateDiscriminatorValueNotOnRoot,
  validateDiscriminatorValueRequiresHierarchy,
  validateInheritanceRequiresDiscriminator,
  validateJoinedDepth,
  validateSubtypeHasDiscriminatorValue,
  validateUniqueDiscriminatorValues,
} from "./validate-inheritance.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test entity hierarchies
// ─────────────────────────────────────────────────────────────────────────────

// Valid root: both @Inheritance and @Discriminator
@Entity({ name: "ValidRoot" })
@Discriminator("type")
@Inheritance()
class ValidRoot {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;
}

// @Discriminator without @Inheritance (invalid)
@Entity({ name: "DiscriminatorWithoutInheritance" })
@Discriminator("type")
class DiscriminatorWithoutInheritance {
  @PrimaryKeyField()
  id!: string;
  type!: string;
}

// @Inheritance without @Discriminator (invalid)
@Entity({ name: "InheritanceWithoutDiscriminator" })
@Inheritance()
class InheritanceWithoutDiscriminator {
  @PrimaryKeyField()
  id!: string;
}

// Root with @DiscriminatorValue (invalid — root should not have a discriminator value)
@Entity({ name: "RootWithDiscriminatorValue" })
@DiscriminatorValue("oops")
@Discriminator("type")
@Inheritance()
class RootWithDiscriminatorValue {
  @PrimaryKeyField()
  id!: string;
  type!: string;
}

// Subtype in a valid hierarchy
@Entity({ name: "ValidRootForSubtype" })
@Discriminator("type")
@Inheritance()
class ValidRootForSubtype {
  @PrimaryKeyField()
  id!: string;
  type!: string;
}

@Entity({ name: "ValidSubtype" })
@DiscriminatorValue("child")
class ValidSubtype extends ValidRootForSubtype {}

// Subtype without @DiscriminatorValue and not abstract
@Entity({ name: "RootForMissingValue" })
@Discriminator("type")
@Inheritance()
class RootForMissingValue {
  @PrimaryKeyField()
  id!: string;
  type!: string;
}

@Entity({ name: "SubtypeWithoutValue" })
class SubtypeWithoutValue extends RootForMissingValue {}

// Abstract subtype (no @DiscriminatorValue required)
@Entity({ name: "RootForAbstractSubtype" })
@Discriminator("type")
@Inheritance()
class RootForAbstractSubtype {
  @PrimaryKeyField()
  id!: string;
  type!: string;
}

@AbstractEntity()
class AbstractSubtype extends RootForAbstractSubtype {}

// @DiscriminatorValue without any @Inheritance in chain (orphan)
@Entity({ name: "OrphanDiscriminatorValue" })
@DiscriminatorValue("orphan")
class OrphanDiscriminatorValue {
  @PrimaryKeyField()
  id!: string;
}

// Joined hierarchy: root and direct subtypes (valid)
@Entity({ name: "JoinedRoot" })
@Discriminator("type")
@Inheritance("joined")
class JoinedRoot {
  @PrimaryKeyField()
  id!: string;
  type!: string;
}

@Entity({ name: "JoinedChild" })
@DiscriminatorValue("joined-child")
class JoinedChild extends JoinedRoot {}

// Multi-level joined hierarchy: root → intermediate → leaf (invalid depth > 1)
@Entity({ name: "JoinedMultiRoot" })
@Discriminator("type")
@Inheritance("joined")
class JoinedMultiRoot {
  @PrimaryKeyField()
  id!: string;
  type!: string;
}

@Entity({ name: "JoinedIntermediate" })
@DiscriminatorValue("intermediate")
class JoinedIntermediate extends JoinedMultiRoot {}

@Entity({ name: "JoinedDeep" })
@DiscriminatorValue("deep")
class JoinedDeep extends JoinedIntermediate {}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("validateDiscriminatorRequiresInheritance", () => {
  test("should not throw when both @Discriminator and @Inheritance are present", () => {
    expect(() => validateDiscriminatorRequiresInheritance(ValidRoot)).not.toThrow();
  });

  test("should throw when @Discriminator is present without @Inheritance on same class", () => {
    expect(() =>
      validateDiscriminatorRequiresInheritance(DiscriminatorWithoutInheritance),
    ).toThrow("@Discriminator requires @Inheritance");
  });

  test("should not throw when a class has neither decorator", () => {
    class PlainClass {}
    expect(() => validateDiscriminatorRequiresInheritance(PlainClass)).not.toThrow();
  });

  test("should not throw when @Inheritance exists but not @Discriminator (different validator)", () => {
    expect(() =>
      validateDiscriminatorRequiresInheritance(InheritanceWithoutDiscriminator),
    ).not.toThrow();
  });
});

describe("validateInheritanceRequiresDiscriminator", () => {
  test("should not throw when both @Inheritance and @Discriminator are present", () => {
    expect(() => validateInheritanceRequiresDiscriminator(ValidRoot)).not.toThrow();
  });

  test("should throw when @Inheritance is present without @Discriminator", () => {
    expect(() =>
      validateInheritanceRequiresDiscriminator(InheritanceWithoutDiscriminator),
    ).toThrow("@Inheritance on");
  });

  test("should not throw when a class has neither decorator", () => {
    class PlainClass {}
    expect(() => validateInheritanceRequiresDiscriminator(PlainClass)).not.toThrow();
  });
});

describe("validateDiscriminatorValueNotOnRoot", () => {
  test("should not throw for a valid root (no @DiscriminatorValue)", () => {
    expect(() => validateDiscriminatorValueNotOnRoot(ValidRoot)).not.toThrow();
  });

  test("should throw when @DiscriminatorValue is on the root entity", () => {
    expect(() => validateDiscriminatorValueNotOnRoot(RootWithDiscriminatorValue)).toThrow(
      "@DiscriminatorValue cannot be applied to inheritance root",
    );
  });

  test("should not throw for a subtype that has @DiscriminatorValue but no @Inheritance", () => {
    // ValidSubtype has @DiscriminatorValue but does not own @Inheritance
    expect(() => validateDiscriminatorValueNotOnRoot(ValidSubtype)).not.toThrow();
  });

  test("should not throw when class has neither @Inheritance nor @DiscriminatorValue", () => {
    class PlainClass {}
    expect(() => validateDiscriminatorValueNotOnRoot(PlainClass)).not.toThrow();
  });
});

describe("validateDiscriminatorValueRequiresHierarchy", () => {
  test("should not throw for a valid subtype within an inheritance hierarchy", () => {
    expect(() => validateDiscriminatorValueRequiresHierarchy(ValidSubtype)).not.toThrow();
  });

  test("should not throw when class has no @DiscriminatorValue", () => {
    expect(() => validateDiscriminatorValueRequiresHierarchy(ValidRoot)).not.toThrow();
  });

  test("should throw when @DiscriminatorValue exists but no @Inheritance in chain", () => {
    expect(() =>
      validateDiscriminatorValueRequiresHierarchy(OrphanDiscriminatorValue),
    ).toThrow("@DiscriminatorValue on");
  });

  test("should not throw for a class without any decorators", () => {
    class PlainClass {}
    expect(() => validateDiscriminatorValueRequiresHierarchy(PlainClass)).not.toThrow();
  });
});

describe("validateUniqueDiscriminatorValues", () => {
  test("should not throw when discriminator value is unique in the map", () => {
    const children = new Map<string | number, Function>();
    children.set("car", class Car {});
    expect(() =>
      validateUniqueDiscriminatorValues("Vehicle", children, "truck", class Truck {}),
    ).not.toThrow();
  });

  test("should throw when discriminator value already exists in the map", () => {
    const Car = class Car {};
    const children = new Map<string | number, Function>([["car", Car]]);
    expect(() =>
      validateUniqueDiscriminatorValues("Vehicle", children, "car", class AnotherCar {}),
    ).toThrow('Discriminator value "car" is already used by entity');
  });

  test("should throw with numeric discriminator value collision", () => {
    const TypeOne = class TypeOne {};
    const children = new Map<string | number, Function>([[1, TypeOne]]);
    expect(() =>
      validateUniqueDiscriminatorValues("Base", children, 1, class TypeOneAgain {}),
    ).toThrow('Discriminator value "1" is already used by entity');
  });

  test("should not throw when map is empty", () => {
    const children = new Map<string | number, Function>();
    expect(() =>
      validateUniqueDiscriminatorValues("Vehicle", children, "car", class Car {}),
    ).not.toThrow();
  });
});

describe("validateSubtypeHasDiscriminatorValue", () => {
  test("should not throw when subtype has @DiscriminatorValue", () => {
    expect(() =>
      validateSubtypeHasDiscriminatorValue("ValidRootForSubtype", ValidSubtype),
    ).not.toThrow();
  });

  test("should throw when non-abstract subtype is missing @DiscriminatorValue", () => {
    expect(() =>
      validateSubtypeHasDiscriminatorValue("RootForMissingValue", SubtypeWithoutValue),
    ).toThrow("missing @DiscriminatorValue");
  });

  test("should not throw when subtype is abstract (no @DiscriminatorValue needed)", () => {
    expect(() =>
      validateSubtypeHasDiscriminatorValue("RootForAbstractSubtype", AbstractSubtype),
    ).not.toThrow();
  });
});

describe("validateJoinedDepth", () => {
  test("should not throw for a direct child of the root in joined strategy", () => {
    expect(() =>
      validateJoinedDepth("JoinedRoot", JoinedRoot, JoinedChild),
    ).not.toThrow();
  });

  test("should throw when a joined hierarchy has depth > 1 (grandchild of root)", () => {
    expect(() =>
      validateJoinedDepth("JoinedMultiRoot", JoinedMultiRoot, JoinedDeep),
    ).toThrow("does not support multi-level depth");
  });

  test("should throw for depth 0 check when entity is a direct child", () => {
    // Direct child of the root — depth is 0, should not throw
    expect(() =>
      validateJoinedDepth("JoinedRoot", JoinedRoot, JoinedChild),
    ).not.toThrow();
  });
});
